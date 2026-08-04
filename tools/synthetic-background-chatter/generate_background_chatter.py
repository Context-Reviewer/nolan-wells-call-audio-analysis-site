from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import difflib
import hashlib
import importlib.metadata
import json
import math
import platform
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import soundfile as sf
import torch
from faster_whisper import WhisperModel
from faster_whisper.utils import download_model


SCHEMA = "experimental_synthetic_background_chatter_v1"

WARNINGS = [
    "These are high-sensitivity machine-generated interpretations, not verified quotations.",
    "Short-window scanning with VAD disabled can convert noise, music, and artifacts into plausible words.",
    "Recurrence across windows or variants measures reproducibility, not factual truth.",
    "Processed variants may emphasize artifacts as well as speech.",
    "Every candidate must be checked against raw Channel 2.",
    "No candidate names, phrases, prefixes, hotwords, or initial prompts are supplied.",
]

VARIANTS = {
    "raw": {
        "filter": "pan=mono|c0=c1",
        "description": "Raw Channel 2 extraction.",
    },
    "normalized": {
        "filter": (
            "pan=mono|c0=c1,"
            "loudnorm=I=-21:TP=-1.5:LRA=5"
        ),
        "description": (
            "Channel 2 with stronger level normalization. "
            "Low-level noise may also be emphasized."
        ),
    },
    "speech_focus": {
        "filter": (
            "pan=mono|c0=c1,"
            "highpass=f=145,"
            "lowpass=f=6100,"
            "equalizer=f=950:t=q:w=0.85:g=2.5,"
            "equalizer=f=2400:t=q:w=1:g=5,"
            "equalizer=f=3900:t=q:w=1.1:g=3,"
            "acompressor=threshold=0.006:ratio=3.2:"
            "attack=5:release=180:makeup=4,"
            "alimiter=limit=0.90"
        ),
        "description": (
            "High-sensitivity speech-band emphasis and compression. "
            "This is diagnostic processing, not recovered speech."
        ),
    },
}


@dataclasses.dataclass(frozen=True)
class WindowPlan:
    duration: float
    hop: float


@dataclasses.dataclass(frozen=True)
class DecodePass:
    pass_id: str
    beam_size: int
    best_of: int
    temperature: float


WINDOW_PLANS = [
    WindowPlan(2.6, 0.65),
    WindowPlan(5.2, 1.30),
]

PASSES = [
    DecodePass("beam_unconditioned", 5, 5, 0.0),
    DecodePass("sampling_unconditioned", 1, 5, 0.40),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audio-output-dir", required=True, type=Path)
    parser.add_argument("--work-dir", required=True, type=Path)
    parser.add_argument("--model-cache", required=True, type=Path)
    parser.add_argument("--start", required=True, type=float)
    parser.add_argument("--end", required=True, type=float)
    parser.add_argument("--primary-model", default="small.en")
    parser.add_argument("--confirmation-model", default="large-v3")
    parser.add_argument("--skip-confirmation", action="store_true")
    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "cuda"),
        default="auto",
    )
    parser.add_argument("--language", default="en")
    parser.add_argument("--maximum-candidates", type=int, default=80)
    parser.add_argument("--skip-model-file-hashes", action="store_true")
    return parser.parse_args()


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalized_text(text: str) -> str:
    return re.sub(r"[^a-z0-9']+", " ", text.lower()).strip()


def run(command: list[str]) -> None:
    print("\n> " + subprocess.list2cmdline(command), flush=True)
    completed = subprocess.run(command, check=False)
    if completed.returncode:
        raise RuntimeError(
            f"Command failed with exit code {completed.returncode}"
        )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(
            lambda: stream.read(8 * 1024 * 1024),
            b"",
        ):
            digest.update(chunk)
    return digest.hexdigest()


def package_versions(names: Iterable[str]) -> dict[str, str | None]:
    output: dict[str, str | None] = {}

    for name in names:
        try:
            output[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            output[name] = None

    return output


def model_revision(path: Path) -> str | None:
    parts = list(path.parts)

    if "snapshots" not in parts:
        return None

    index = parts.index("snapshots")
    return parts[index + 1] if index + 1 < len(parts) else None


def hash_model_tree(root: Path) -> list[dict[str, Any]]:
    records = []

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() in {".lock", ".tmp", ".incomplete"}:
            continue

        records.append(
            {
                "path": path.relative_to(root).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )

    return records


def choose_device(requested: str) -> tuple[str, str]:
    try:
        import ctranslate2

        cuda_available = ctranslate2.get_cuda_device_count() > 0
    except Exception:
        cuda_available = False

    if requested == "cuda":
        if not cuda_available:
            raise RuntimeError(
                "CUDA requested, but CTranslate2 detected no CUDA device."
            )
        return "cuda", "float16"

    if requested == "cpu":
        return "cpu", "int8"

    return (
        ("cuda", "float16")
        if cuda_available
        else ("cpu", "int8")
    )


def probe_duration(source: Path) -> float:
    ffprobe = shutil.which("ffprobe")

    if not ffprobe:
        raise RuntimeError("FFprobe was not found in PATH.")

    completed = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(source),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    if completed.returncode:
        raise RuntimeError(
            completed.stderr.strip() or "FFprobe failed."
        )

    return float(completed.stdout.strip())


def extract_variant(
    source: Path,
    wav_path: Path,
    mp3_path: Path,
    filter_chain: str,
    start: float,
    duration: float,
) -> dict[str, Any]:
    ffmpeg = shutil.which("ffmpeg")

    if not ffmpeg:
        raise RuntimeError("FFmpeg was not found in PATH.")

    wav_path.parent.mkdir(parents=True, exist_ok=True)
    mp3_path.parent.mkdir(parents=True, exist_ok=True)

    wav_command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        f"{start:.6f}",
        "-t",
        f"{duration:.6f}",
        "-i",
        str(source),
        "-vn",
        "-af",
        filter_chain,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(wav_path),
    ]
    run(wav_command)

    mp3_command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(wav_path),
        "-c:a",
        "libmp3lame",
        "-b:a",
        "96k",
        "-map_metadata",
        "-1",
        str(mp3_path),
    ]
    run(mp3_command)

    return {
        "wav_command": [
            Path(item).name if index == 0 else item
            for index, item in enumerate(wav_command)
        ],
        "mp3_command": [
            Path(item).name if index == 0 else item
            for index, item in enumerate(mp3_command)
        ],
    }


def window_starts(
    total_duration: float,
    plan: WindowPlan,
) -> list[float]:
    if total_duration <= plan.duration:
        return [0.0]

    starts = []
    current = 0.0

    while current + plan.duration < total_duration:
        starts.append(round(current, 6))
        current += plan.hop

    final_start = max(0.0, total_duration - plan.duration)

    if not starts or abs(starts[-1] - final_start) > 0.05:
        starts.append(round(final_start, 6))

    return starts


def rms_db(audio: np.ndarray) -> float:
    value = float(
        np.sqrt(np.mean(np.asarray(audio, dtype=np.float64) ** 2))
    )
    return 20 * math.log10(value + 1e-12)


def transcribe_window(
    *,
    model: WhisperModel,
    model_name: str,
    model_label: str,
    variant: str,
    audio: np.ndarray,
    sample_rate: int,
    relative_start: float,
    absolute_selection_start: float,
    plan: WindowPlan,
    decode_pass: DecodePass,
    language: str,
) -> list[dict[str, Any]]:
    start_sample = int(round(relative_start * sample_rate))
    end_sample = min(
        len(audio),
        start_sample + int(round(plan.duration * sample_rate)),
    )
    window = np.asarray(audio[start_sample:end_sample], dtype=np.float32)

    if not len(window):
        return []

    expected_samples = int(round(plan.duration * sample_rate))

    if len(window) < expected_samples:
        window = np.pad(
            window,
            (0, expected_samples - len(window)),
        )

    segments_iterator, info = model.transcribe(
        window,
        language=language,
        task="transcribe",
        beam_size=decode_pass.beam_size,
        best_of=decode_pass.best_of,
        temperature=decode_pass.temperature,
        condition_on_previous_text=False,
        word_timestamps=True,
        vad_filter=False,
        compression_ratio_threshold=2.8,
        log_prob_threshold=-2.5,
        no_speech_threshold=1.0,
        initial_prompt=None,
        prefix=None,
        hotwords=None,
    )

    window_absolute_start = (
        absolute_selection_start + relative_start
    )
    records = []

    for segment in segments_iterator:
        text = clean_text(segment.text)

        if not text:
            continue

        absolute_start = (
            window_absolute_start + float(segment.start)
        )
        absolute_end = (
            window_absolute_start + float(segment.end)
        )

        words = []

        for word in segment.words or []:
            words.append(
                {
                    "start": round(
                        window_absolute_start + float(word.start),
                        3,
                    ),
                    "end": round(
                        window_absolute_start + float(word.end),
                        3,
                    ),
                    "word": word.word,
                    "probability": round(
                        float(word.probability),
                        6,
                    ),
                }
            )

        records.append(
            {
                "run_id": (
                    f"{model_label}:{variant}:"
                    f"{plan.duration:.1f}:{relative_start:.2f}:"
                    f"{decode_pass.pass_id}"
                ),
                "model_name": model_name,
                "model_label": model_label,
                "variant": variant,
                "window_duration": plan.duration,
                "window_hop": plan.hop,
                "window_start": round(
                    window_absolute_start,
                    3,
                ),
                "window_end": round(
                    window_absolute_start + plan.duration,
                    3,
                ),
                "segment_start": round(absolute_start, 3),
                "segment_end": round(absolute_end, 3),
                "pass_id": decode_pass.pass_id,
                "text": text,
                "normalized": normalized_text(text),
                "avg_logprob": round(
                    float(segment.avg_logprob),
                    6,
                ),
                "no_speech_prob": round(
                    float(segment.no_speech_prob),
                    6,
                ),
                "window_rms_db": round(rms_db(window), 3),
                "language": info.language,
                "language_probability": round(
                    float(info.language_probability),
                    6,
                ),
                "words": words,
            }
        )

    return records


def temporal_overlap(
    first: dict[str, Any],
    second: dict[str, Any],
) -> float:
    return max(
        0.0,
        min(first["segment_end"], second["segment_end"])
        - max(first["segment_start"], second["segment_start"]),
    )


def temporal_iou(
    first: dict[str, Any],
    second: dict[str, Any],
) -> float:
    common = temporal_overlap(first, second)
    union = (
        max(first["segment_end"], second["segment_end"])
        - min(first["segment_start"], second["segment_start"])
    )
    return common / union if union > 0 else 0.0


def text_similarity(first: str, second: str) -> float:
    if not first or not second:
        return 0.0

    return difflib.SequenceMatcher(
        None,
        first,
        second,
    ).ratio()


def cluster_outputs(
    outputs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    clusters: list[dict[str, Any]] = []

    ordered = sorted(
        outputs,
        key=lambda item: (
            item["segment_start"],
            item["segment_end"],
            item["avg_logprob"],
        ),
    )

    for output in ordered:
        best_cluster = None
        best_score = 0.0

        for cluster in clusters:
            representative = cluster["representative"]
            time_score = temporal_iou(
                output,
                representative,
            )
            word_score = text_similarity(
                output["normalized"],
                representative["normalized"],
            )

            if time_score < 0.14:
                continue

            combined = 0.48 * time_score + 0.52 * word_score

            if word_score >= 0.56 and combined > best_score:
                best_cluster = cluster
                best_score = combined

        if best_cluster is None:
            clusters.append(
                {
                    "representative": output,
                    "sources": [output],
                }
            )
            continue

        best_cluster["sources"].append(output)
        best_cluster["representative"] = max(
            best_cluster["sources"],
            key=lambda item: (
                item["variant"] == "raw",
                item["model_label"] == "confirmation",
                item["pass_id"] == "beam_unconditioned",
                item["avg_logprob"],
            ),
        )

    candidates = []

    for cluster in clusters:
        sources = cluster["sources"]
        representative = cluster["representative"]
        variants = sorted({item["variant"] for item in sources})
        models = sorted({item["model_name"] for item in sources})
        passes = sorted({item["pass_id"] for item in sources})
        windows = sorted(
            {
                (
                    item["window_duration"],
                    item["window_start"],
                )
                for item in sources
            }
        )

        if len(models) >= 2 and len(variants) >= 2:
            label = "repeated multi-model, multi-variant candidate"
        elif len(models) >= 2:
            label = "repeated across models"
        elif len(variants) >= 2 and len(windows) >= 2:
            label = "repeated multi-stream candidate"
        elif len(windows) >= 2:
            label = "repeated overlapping-window candidate"
        else:
            label = "single-output weak candidate"

        best_word_probability = max(
            (
                word["probability"]
                for item in sources
                for word in item["words"]
            ),
            default=None,
        )

        candidates.append(
            {
                "text": representative["text"],
                "start": round(
                    min(item["segment_start"] for item in sources),
                    3,
                ),
                "end": round(
                    max(item["segment_end"] for item in sources),
                    3,
                ),
                "support_label": label,
                "supporting_outputs": len(sources),
                "supporting_models": models,
                "supporting_variants": variants,
                "supporting_passes": passes,
                "supporting_windows": len(windows),
                "best_avg_logprob": max(
                    item["avg_logprob"] for item in sources
                ),
                "lowest_no_speech_prob": min(
                    item["no_speech_prob"] for item in sources
                ),
                "best_word_probability": best_word_probability,
                "sources": sorted(
                    sources,
                    key=lambda item: (
                        item["model_label"] != "confirmation",
                        item["variant"] != "raw",
                        -item["avg_logprob"],
                    ),
                ),
            }
        )

    candidates.sort(
        key=lambda item: (
            item["supporting_models"].__len__(),
            item["supporting_variants"].__len__(),
            item["supporting_windows"],
            item["supporting_outputs"],
            item["best_avg_logprob"],
        ),
        reverse=True,
    )

    for index, candidate in enumerate(candidates, start=1):
        candidate["rank"] = index

    return candidates


def main() -> int:
    args = parse_args()
    source = args.source.resolve()

    if not source.is_file():
        raise FileNotFoundError(source)

    source_duration = probe_duration(source)
    selection_start = max(0.0, min(args.start, source_duration))
    selection_end = max(
        selection_start + 0.05,
        min(args.end, source_duration),
    )
    selection_duration = selection_end - selection_start

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.audio_output_dir.mkdir(parents=True, exist_ok=True)
    args.work_dir.mkdir(parents=True, exist_ok=True)
    args.model_cache.mkdir(parents=True, exist_ok=True)

    variants = {}
    loaded_audio: dict[str, tuple[np.ndarray, int]] = {}

    for variant_name, configuration in VARIANTS.items():
        wav_path = args.work_dir / f"{variant_name}.wav"
        mp3_path = args.audio_output_dir / f"{variant_name}.mp3"

        commands = extract_variant(
            source,
            wav_path,
            mp3_path,
            configuration["filter"],
            selection_start,
            selection_duration,
        )

        audio, sample_rate = sf.read(
            wav_path,
            dtype="float32",
            always_2d=False,
        )

        if audio.ndim > 1:
            audio = audio[:, 0]

        loaded_audio[variant_name] = (
            np.asarray(audio, dtype=np.float32),
            int(sample_rate),
        )

        variants[variant_name] = {
            "description": configuration["description"],
            "filter_chain": configuration["filter"],
            "public_audio_path": (
                "assets/audio/synthetic-background-chatter/"
                + mp3_path.name
            ),
            "sha256": sha256_file(mp3_path),
            "bytes": mp3_path.stat().st_size,
            **commands,
        }

    device, compute_type = choose_device(args.device)

    model_specs = [
        ("screening", args.primary_model),
    ]

    if not args.skip_confirmation:
        model_specs.append(
            ("confirmation", args.confirmation_model)
        )

    all_outputs = []
    model_records = []

    for model_label, model_name in model_specs:
        print(f"\nResolving model: {model_name}", flush=True)

        model_path = Path(
            download_model(
                model_name,
                cache_dir=str(
                    args.model_cache / "faster-whisper"
                ),
            )
        )

        print(
            f"Loading {model_name} on {device} ({compute_type})",
            flush=True,
        )

        model = WhisperModel(
            str(model_path),
            device=device,
            compute_type=compute_type,
        )

        for variant_name, (audio, sample_rate) in loaded_audio.items():
            for plan in WINDOW_PLANS:
                starts = window_starts(
                    selection_duration,
                    plan,
                )

                for relative_start in starts:
                    pass_configs = PASSES

                    if (
                        model_label == "confirmation"
                        and variant_name == "speech_focus"
                    ):
                        pass_configs = PASSES[:1]

                    for decode_pass in pass_configs:
                        print(
                            f"{model_label} · {variant_name} · "
                            f"{plan.duration:.1f}s @ "
                            f"{selection_start + relative_start:.2f}s · "
                            f"{decode_pass.pass_id}",
                            flush=True,
                        )

                        all_outputs.extend(
                            transcribe_window(
                                model=model,
                                model_name=model_name,
                                model_label=model_label,
                                variant=variant_name,
                                audio=audio,
                                sample_rate=sample_rate,
                                relative_start=relative_start,
                                absolute_selection_start=selection_start,
                                plan=plan,
                                decode_pass=decode_pass,
                                language=args.language,
                            )
                        )

        model_records.append(
            {
                "model_label": model_label,
                "model_name": model_name,
                "resolved_revision": model_revision(model_path),
                "device": device,
                "compute_type": compute_type,
                "local_model_files": (
                    None
                    if args.skip_model_file_hashes
                    else hash_model_tree(model_path)
                ),
            }
        )

        del model

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    candidates = cluster_outputs(all_outputs)
    candidates = candidates[: args.maximum_candidates]

    result = {
        "schema": SCHEMA,
        "generated_at_utc": utc_now(),
        "status": (
            "high-sensitivity synthetic background-speech "
            "interpretation; not evidence"
        ),
        "warnings": WARNINGS,
        "source": {
            "file_name": source.name,
            "bytes": source.stat().st_size,
            "sha256": sha256_file(source),
            "duration_seconds": round(source_duration, 3),
        },
        "selection": {
            "start": round(selection_start, 3),
            "end": round(selection_end, 3),
            "duration": round(selection_duration, 3),
            "channel": 2,
        },
        "configuration": {
            "window_plans": [
                dataclasses.asdict(plan)
                for plan in WINDOW_PLANS
            ],
            "passes": [
                dataclasses.asdict(decode_pass)
                for decode_pass in PASSES
            ],
            "vad_filter": False,
            "no_speech_threshold": 1.0,
            "initial_prompt": None,
            "prefix": None,
            "hotwords": None,
            "candidate_phrase_prompting": False,
            "maximum_candidates": args.maximum_candidates,
        },
        "variants": variants,
        "models": model_records,
        "candidates": candidates,
        "all_model_outputs": all_outputs,
        "environment": {
            "python": sys.version,
            "platform": platform.platform(),
            "processor": platform.processor(),
            "packages": package_versions(
                [
                    "faster-whisper",
                    "ctranslate2",
                    "numpy",
                    "soundfile",
                    "torch",
                ]
            ),
        },
    }

    temporary = args.output.with_suffix(
        args.output.suffix + ".tmp"
    )
    temporary.write_text(
        json.dumps(result, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    temporary.replace(args.output)

    print(f"\nWrote: {args.output}")
    print(f"Raw model outputs: {len(all_outputs)}")
    print(f"Candidate clusters: {len(candidates)}")

    for candidate in candidates[:20]:
        print(
            f"{candidate['start']:.2f}-"
            f"{candidate['end']:.2f}: "
            f"{candidate['support_label']} — "
            f"{candidate['text']}",
            flush=True,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

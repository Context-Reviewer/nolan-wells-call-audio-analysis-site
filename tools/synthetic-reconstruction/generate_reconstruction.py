from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import difflib
import hashlib
import importlib.metadata
import json
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable

import torch
from faster_whisper import WhisperModel
from faster_whisper.utils import download_model


SCHEMA = "experimental_synthetic_reconstruction_v1"

WARNINGS = [
    "These are synthetic model interpretations, not recovered or verified speech.",
    "Context-conditioned and sampling passes may generate plausible wording that was not spoken.",
    "Processed audio variants may emphasize artifacts as well as speech.",
    "Support counts measure recurrence across configured model outputs, not factual confidence.",
    "Every candidate must be compared against raw Channel 2.",
    "The browser uses a neutral synthetic voice and does not imitate the original speaker.",
    "The source is YouTube-derived and is not represented as the native MDMR recording.",
]

VARIANTS = {
    "raw": {
        "filter": "pan=mono|c0=c1",
        "description": "Raw Channel 2 extraction without enhancement.",
    },
    "normalized": {
        "filter": "pan=mono|c0=c1,loudnorm=I=-24:TP=-2:LRA=7",
        "description": "Channel 2 with level normalization; noise may also be emphasized.",
    },
    "speech_focus": {
        "filter": (
            "pan=mono|c0=c1,highpass=f=120,lowpass=f=6500,"
            "equalizer=f=2800:t=q:w=1:g=4,loudnorm=I=-24:TP=-2:LRA=7"
        ),
        "description": "Channel 2 with conservative speech-band EQ and normalization.",
    },
    "continuity": {
        "filter": (
            "pan=mono|c0=c1,highpass=f=75,lowpass=f=7600,"
            "equalizer=f=260:t=q:w=0.75:g=-2.5,"
            "equalizer=f=1450:t=q:w=0.85:g=2.6,"
            "equalizer=f=2850:t=q:w=1:g=4,"
            "acompressor=threshold=0.008:ratio=2.4:attack=7:release=150:makeup=3,"
            "alimiter=limit=0.90"
        ),
        "description": "Continuity-oriented EQ and compression without gating or VAD.",
    },
}


@dataclasses.dataclass(frozen=True)
class DecodePass:
    pass_id: str
    lane: str
    description: str
    beam_size: int
    best_of: int
    temperature: float
    condition_on_previous_text: bool


PASSES = [
    DecodePass(
        "beam_unconditioned",
        "acoustic",
        "Beam search without prior-text conditioning",
        10,
        10,
        0.0,
        False,
    ),
    DecodePass(
        "beam_conditioned",
        "contextual",
        "Beam search with prior-text conditioning",
        10,
        10,
        0.0,
        True,
    ),
    DecodePass(
        "sampling_unconditioned",
        "acoustic",
        "Low-temperature sampling without prior-text conditioning",
        1,
        8,
        0.30,
        False,
    ),
    DecodePass(
        "sampling_conditioned",
        "contextual",
        "Higher-temperature sampling with prior-text conditioning",
        1,
        8,
        0.55,
        True,
    ),
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
    parser.add_argument("--context-padding", type=float, default=2.0)
    parser.add_argument("--primary-model", default="large-v3")
    parser.add_argument("--secondary-model", default="small.en")
    parser.add_argument("--skip-secondary", action="store_true")
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--language", default="en")
    parser.add_argument("--maximum-candidates", type=int, default=8)
    parser.add_argument("--skip-model-file-hashes", action="store_true")
    return parser.parse_args()


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalized_text(text: str) -> str:
    return re.sub(r"[^a-z0-9']+", " ", text.lower()).strip()


def run(command: list[str]) -> None:
    print("\n> " + subprocess.list2cmdline(command), flush=True)
    result = subprocess.run(command, check=False)
    if result.returncode:
        raise RuntimeError(f"Command failed with exit code {result.returncode}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_versions(names: Iterable[str]) -> dict[str, str | None]:
    result: dict[str, str | None] = {}
    for name in names:
        try:
            result[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            result[name] = None
    return result


def model_revision(path: Path) -> str | None:
    parts = list(path.parts)
    if "snapshots" not in parts:
        return None
    index = parts.index("snapshots")
    return parts[index + 1] if index + 1 < len(parts) else None


def hash_model_tree(root: Path) -> list[dict[str, Any]]:
    output = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() in {".lock", ".tmp", ".incomplete"}:
            continue
        output.append(
            {
                "path": path.relative_to(root).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    return output


def choose_device(requested: str) -> tuple[str, str]:
    try:
        import ctranslate2

        cuda_available = ctranslate2.get_cuda_device_count() > 0
    except Exception:
        cuda_available = False

    if requested == "cuda":
        if not cuda_available:
            raise RuntimeError("CUDA requested, but CTranslate2 found no CUDA device.")
        return "cuda", "float16"
    if requested == "cpu":
        return "cpu", "int8"
    return ("cuda", "float16") if cuda_available else ("cpu", "int8")


def probe_duration(source: Path) -> float:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        raise RuntimeError("FFprobe was not found in PATH.")
    result = subprocess.run(
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
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "FFprobe failed.")
    return float(result.stdout.strip())


def extract_variant(
    source: Path,
    wav_path: Path,
    mp3_path: Path,
    filter_chain: str,
    context_start: float,
    context_duration: float,
) -> dict[str, list[str]]:
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
        f"{context_start:.6f}",
        "-t",
        f"{context_duration:.6f}",
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
        "wav_command": [Path(item).name if i == 0 else item for i, item in enumerate(wav_command)],
        "mp3_command": [Path(item).name if i == 0 else item for i, item in enumerate(mp3_command)],
    }


def overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def serialize_word(word: Any, offset: float) -> dict[str, Any]:
    return {
        "start": round(offset + float(word.start), 3),
        "end": round(offset + float(word.end), 3),
        "word": word.word,
        "probability": round(float(word.probability), 6),
    }


def transcribe_one(
    model: WhisperModel,
    model_name: str,
    model_label: str,
    variant: str,
    audio_path: Path,
    decode_pass: DecodePass,
    language: str,
    absolute_offset: float,
    target_start: float,
    target_end: float,
) -> dict[str, Any]:
    run_id = f"{model_label}:{variant}:{decode_pass.pass_id}"
    print(f"Pass: {run_id}", flush=True)

    segments_iter, info = model.transcribe(
        str(audio_path),
        language=language,
        task="transcribe",
        beam_size=decode_pass.beam_size,
        best_of=decode_pass.best_of,
        temperature=decode_pass.temperature,
        condition_on_previous_text=decode_pass.condition_on_previous_text,
        word_timestamps=True,
        vad_filter=False,
        compression_ratio_threshold=2.6,
        log_prob_threshold=-2.0,
        no_speech_threshold=1.0,
        initial_prompt=None,
        prefix=None,
        hotwords=None,
    )

    segments = []
    for segment in segments_iter:
        text = clean_text(segment.text)
        if not text and not segment.words:
            continue
        segments.append(
            {
                "start": round(absolute_offset + float(segment.start), 3),
                "end": round(absolute_offset + float(segment.end), 3),
                "text": text,
                "avg_logprob": round(float(segment.avg_logprob), 6),
                "no_speech_prob": round(float(segment.no_speech_prob), 6),
                "words": [
                    serialize_word(word, absolute_offset)
                    for word in (segment.words or [])
                ],
            }
        )

    matching = [
        segment
        for segment in segments
        if overlap(target_start, target_end, segment["start"], segment["end"]) > 0
    ]
    matching.sort(key=lambda item: item["start"])

    durations = [
        max(
            overlap(target_start, target_end, segment["start"], segment["end"]),
            0.001,
        )
        for segment in matching
    ]
    total = sum(durations)

    text = clean_text(" ".join(segment["text"] for segment in matching))
    avg_logprob = (
        sum(segment["avg_logprob"] * duration for segment, duration in zip(matching, durations))
        / total
        if total
        else -99.0
    )
    no_speech = max((segment["no_speech_prob"] for segment in matching), default=1.0)

    words = [
        word
        for segment in matching
        for word in segment["words"]
        if overlap(target_start, target_end, word["start"], word["end"]) > 0
    ]

    return {
        "run_id": run_id,
        "model_label": model_label,
        "model_name": model_name,
        "variant": variant,
        "pass_id": decode_pass.pass_id,
        "description": decode_pass.description,
        "lane": decode_pass.lane,
        "condition_on_previous_text": decode_pass.condition_on_previous_text,
        "temperature": decode_pass.temperature,
        "language": info.language,
        "language_probability": round(float(info.language_probability), 6),
        "text": text,
        "normalized": normalized_text(text),
        "avg_logprob": round(float(avg_logprob), 6),
        "no_speech_prob": round(float(no_speech), 6),
        "words": words,
        "segments": segments,
    }


def similarity(first: str, second: str) -> float:
    if not first or not second:
        return 0.0
    return difflib.SequenceMatcher(None, first, second).ratio()


def group_candidates(outputs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []

    ordered = sorted(
        (item for item in outputs if item["normalized"]),
        key=lambda item: (
            item["lane"] == "acoustic",
            item["variant"] == "raw",
            item["avg_logprob"],
        ),
        reverse=True,
    )

    for output in ordered:
        best = None
        best_score = 0.0

        for group in groups:
            score = similarity(output["normalized"], group["normalized"])
            if score >= 0.82 and score > best_score:
                best = group
                best_score = score

        if best is None:
            groups.append(
                {
                    "text": output["text"],
                    "normalized": output["normalized"],
                    "sources": [output],
                }
            )
        else:
            best["sources"].append(output)
            current_best = max(
                best["sources"],
                key=lambda source: (
                    source["lane"] == "acoustic",
                    source["variant"] == "raw",
                    source["avg_logprob"],
                ),
            )
            best["text"] = current_best["text"]
            best["normalized"] = current_best["normalized"]

    candidates = []

    for group in groups:
        sources = group["sources"]
        variants = sorted({source["variant"] for source in sources})
        models = sorted({source["model_name"] for source in sources})
        passes = sorted({source["pass_id"] for source in sources})
        acoustic = [source for source in sources if source["lane"] == "acoustic"]
        contextual = [source for source in sources if source["lane"] == "contextual"]
        raw_acoustic = [
            source
            for source in acoustic
            if source["variant"] == "raw"
        ]

        word_probabilities = [
            word["probability"]
            for source in sources
            for word in source["words"]
        ]

        if len(raw_acoustic) >= 2 and len(models) >= 2:
            label = "acoustically recurrent across models"
        elif raw_acoustic and len(variants) >= 2:
            label = "mixed acoustic and contextual candidate"
        elif not acoustic:
            label = "context-generated completion"
        elif not raw_acoustic:
            label = "processed-only weak candidate"
        elif contextual:
            label = "single raw-acoustic candidate with context support"
        else:
            label = "single-stream weak candidate"

        candidates.append(
            {
                "text": group["text"],
                "support_label": label,
                "supporting_outputs": len(sources),
                "supporting_variants": variants,
                "supporting_models": models,
                "supporting_passes": passes,
                "acoustic_output_count": len(acoustic),
                "contextual_output_count": len(contextual),
                "raw_acoustic_output_count": len(raw_acoustic),
                "best_avg_logprob": max(source["avg_logprob"] for source in sources),
                "lowest_no_speech_prob": min(source["no_speech_prob"] for source in sources),
                "best_word_probability": max(word_probabilities) if word_probabilities else None,
                "sources": [
                    {
                        "run_id": source["run_id"],
                        "model_name": source["model_name"],
                        "variant": source["variant"],
                        "pass_id": source["pass_id"],
                        "lane": source["lane"],
                        "text": source["text"],
                        "avg_logprob": source["avg_logprob"],
                        "no_speech_prob": source["no_speech_prob"],
                    }
                    for source in sources
                ],
            }
        )

    candidates.sort(
        key=lambda item: (
            item["raw_acoustic_output_count"],
            len(item["supporting_models"]),
            len(item["supporting_variants"]),
            item["acoustic_output_count"],
            item["supporting_outputs"],
            item["best_avg_logprob"],
        ),
        reverse=True,
    )

    for index, candidate in enumerate(candidates, start=1):
        candidate["rank"] = index
        candidate["alternative_id"] = chr(64 + index)

    return candidates


def main() -> int:
    args = parse_args()
    source = args.source.resolve()

    if not source.is_file():
        raise FileNotFoundError(source)

    source_duration = probe_duration(source)
    target_start = max(0.0, min(args.start, source_duration))
    target_end = max(target_start + 0.05, min(args.end, source_duration))
    padding = max(0.0, args.context_padding)
    context_start = max(0.0, target_start - padding)
    context_end = min(source_duration, target_end + padding)
    context_duration = context_end - context_start

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.audio_output_dir.mkdir(parents=True, exist_ok=True)
    args.work_dir.mkdir(parents=True, exist_ok=True)
    args.model_cache.mkdir(parents=True, exist_ok=True)

    variants = {}
    variant_wavs = {}

    for name, configuration in VARIANTS.items():
        wav_path = args.work_dir / f"{name}.wav"
        mp3_path = args.audio_output_dir / f"{name}.mp3"
        commands = extract_variant(
            source,
            wav_path,
            mp3_path,
            configuration["filter"],
            context_start,
            context_duration,
        )
        variant_wavs[name] = wav_path
        variants[name] = {
            "description": configuration["description"],
            "filter_chain": configuration["filter"],
            "public_audio_path": f"assets/audio/synthetic-reconstruction/{mp3_path.name}",
            "sha256": sha256_file(mp3_path),
            "bytes": mp3_path.stat().st_size,
            **commands,
        }

    device, compute_type = choose_device(args.device)
    model_specs = [("primary", args.primary_model)]

    if not args.skip_secondary:
        model_specs.append(("secondary", args.secondary_model))

    outputs = []
    model_records = []

    for model_label, model_name in model_specs:
        print(f"\nResolving contextual model: {model_name}", flush=True)
        model_path = Path(
            download_model(
                model_name,
                cache_dir=str(args.model_cache / "faster-whisper"),
            )
        )
        print(f"Loading {model_name} on {device} ({compute_type})", flush=True)
        model = WhisperModel(
            str(model_path),
            device=device,
            compute_type=compute_type,
        )

        for variant_name, wav_path in variant_wavs.items():
            for decode_pass in PASSES:
                outputs.append(
                    transcribe_one(
                        model,
                        model_name,
                        model_label,
                        variant_name,
                        wav_path,
                        decode_pass,
                        args.language,
                        context_start,
                        target_start,
                        target_end,
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

    candidates = group_candidates(outputs)[: args.maximum_candidates]

    result = {
        "schema": SCHEMA,
        "generated_at_utc": now_utc(),
        "status": "synthetic model interpretation; not recovered speech and not evidence",
        "warnings": WARNINGS,
        "source": {
            "file_name": source.name,
            "bytes": source.stat().st_size,
            "sha256": sha256_file(source),
            "duration_seconds": round(source_duration, 3),
            "provenance": (
                "YouTube-derived public working source; not represented as "
                "the native MDMR recording."
            ),
        },
        "selection": {
            "start": round(target_start, 3),
            "end": round(target_end, 3),
            "duration": round(target_end - target_start, 3),
            "channel": 2,
            "context_start": round(context_start, 3),
            "context_end": round(context_end, 3),
            "context_padding_requested": padding,
        },
        "configuration": {
            "vad_filter": False,
            "no_speech_threshold": 1.0,
            "initial_prompt": None,
            "prefix": None,
            "hotwords": None,
            "candidate_phrase_prompting": False,
            "passes": [dataclasses.asdict(item) for item in PASSES],
            "maximum_candidates": args.maximum_candidates,
        },
        "variants": variants,
        "models": model_records,
        "candidates": candidates,
        "all_model_outputs": outputs,
        "environment": {
            "python": sys.version,
            "platform": platform.platform(),
            "processor": platform.processor(),
            "packages": package_versions(
                ["faster-whisper", "ctranslate2", "torch"]
            ),
        },
        "interpretation_rules": {
            "acoustic_lane": (
                "Unconditioned passes reduce prior-text influence but still use "
                "a learned language model."
            ),
            "contextual_lane": (
                "Conditioned passes intentionally permit stronger contextual completion."
            ),
            "synthetic_playback": (
                "The browser reads candidate text with a neutral speech-synthesis voice."
            ),
        },
    }

    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(args.output)

    print(f"\nWrote: {args.output}")
    print(f"Candidates retained: {len(candidates)}")
    for candidate in candidates:
        print(
            f"{candidate['alternative_id']}: "
            f"{candidate['support_label']} — {candidate['text']}",
            flush=True,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

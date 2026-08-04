# Methodology: Experimental Machine-Generated Phonetic Hypotheses

## Status

This output is not a certified forensic transcript. It is a reproducible machine-hypothesis package intended to identify intervals that deserve direct review against raw isolated audio.

## Input

The generator extracts the second stereo channel from the complete preserved source with FFmpeg using `pan=mono|c0=c1`, then resamples it to 16 kHz PCM for inference. The source and extracted channel are hashed with SHA-256.

## Contextual recognizers

The generator runs multiple decoding configurations without an initial prompt, prefix, hotword list, expected name, or supplied candidate phrase:

1. beam search without prior-segment conditioning;
2. beam search with prior-segment conditioning;
3. temperature sampling without prior-segment conditioning.

A second Whisper-family model may be used, but agreement between two Whisper models is not treated as fully independent architectural confirmation.

## Phoneme recognizer

An independent Wav2Vec2 CTC phoneme model operates on the same raw Channel 2 intervals. A bounded CTC prefix-beam search preserves several phoneme sequences instead of returning only the greedy path.

## Alternatives

Word alternatives are collected from configured decoding passes and aligned primarily by timestamps. The set is finite, model-generated, and not exhaustive.

## Filtering

Recognizers use the raw extracted Channel 2 PCM. Browser listening filters do not modify the hypothesis package.

## Interpretation rule

Every candidate must be checked against raw Channel 2, the same interval with processing bypassed, competing machine alternatives, and the possibility of unclear or non-speech audio.

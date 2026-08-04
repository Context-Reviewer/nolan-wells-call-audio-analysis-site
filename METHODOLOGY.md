# Methodology

## 1. Source acquisition

The highest-quality audio-only stream offered for YouTube video `oshE23g-rTY` was
downloaded without transcoding. The selected stream was WebM/Opus, 48 kHz, two channels,
approximately 143.3 kb/s, with a duration of approximately 585.62 seconds.

A FLAC working copy was then created to prevent additional lossy encoding during analysis.
Converting Opus to FLAC does not restore information already lost in the source chain.

## 2. Channel inspection

The channels were extracted independently and compared using:

- whole-file linear correlation;
- RMS and peak measurements;
- spectrograms;
- silence and near-silence detection;
- listening to recognizable foreground dialogue.

The whole-file channel correlation was approximately `0.00036`; the first 18 seconds
measured approximately `0.001484`. These values are inconsistent with simple duplicated
stereo and support treating the channels as separate call sides or separately recorded
feeds.

## 3. Opening isolation

The first 18 seconds were examined separately. Channel 1 showed stable harmonic content
consistent with hold music. Channel 2 showed intermittent speech-band microphone
activity. Channel 2 was therefore isolated directly rather than subtracting or
reconstructing music.

Candidate windows:

| Candidate | Broad window | Tight review window | Initial interpretation |
|---|---:|---:|---|
| A | 0.00–1.80 s | 0.20–1.38 s | “shut the fuck up” |
| B | 3.40–8.80 s | 3.55–7.25 s | unintelligible/control |
| C | 10.80–15.80 s | 12.85–14.65 s | “oh my God” |

Second-pass windows were widened slightly to preserve consonant onsets and trailing
syllables:

- A: 0.08–1.62 s
- C: 12.55–15.05 s

## 4. Processing

Only conventional signal processing was used:

- channel extraction;
- high-pass, low-pass and band-pass filtering;
- spectral noise reduction;
- level normalization and mild compression;
- harmonic/percussive separation as a diagnostic aid;
- non-generative repetitive-background estimation;
- pitch-preserving time stretching.

No language model generated, completed or reconstructed speech.

## 5. Interpretation standard

A proposed phrase is stronger when it:

1. remains perceptible in the raw isolated channel;
2. remains compatible with a conservative cleanup;
3. has stable timing and phonetic structure across mild processing variants;
4. is independently transcribed by unprimed listeners;
5. does not appear only after captions or aggressive enhancement are supplied.

Aggressive processing can make a preferred interpretation easier to hear without making
that interpretation more accurate.

## 6. Blind listening

The blind-test packet contains randomized raw and gently processed versions of A, B and
C. Candidate B is retained as a control. Listeners should not see the answer key or any
suspected phrase before recording their own transcription and confidence.

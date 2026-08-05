# Processing-residue playback

**Document ID:** NW-FA-RES-001  
**Version:** 1.0  
**Effective date:** 2026-08-05

## Purpose

Provide a direct quality-control comparison between:

1. the routed signal before browser filtering;
2. the signal after the active browser filters and optional compressor; and
3. the arithmetic residue calculated as raw minus processed.

The feature helps identify whether a listening conclusion depends on material
introduced, suppressed, phase-shifted, delayed, or otherwise changed by the
processing chain.

## Signal definition

The audit point is after channel routing and per-channel gain, but before the
filter chain.

- **Raw:** routed audit signal before filtering.
- **Processed:** output after high-pass, low-pass, notch, presence EQ, and the
  selected dry/compressed path.
- **Residue:** raw minus processed, calculated in the live Web Audio graph.

The same master gain and analyzer follow all three audit modes.

## Interpretation limitation

Residue is not recovered speech and is not an independent source.

It may contain:

- intentionally attenuated frequency content;
- Biquad-filter phase differences;
- compressor gain and timing differences;
- codec artifacts emphasized by subtraction;
- floating-point and browser-processing differences.

A phonetic impression heard only in residue is not evidence that the phrase
was present in the source.

## True bypass

Disabled filter stages use a zero-gain peaking configuration rather than an
all-pass filter. This avoids treating an amplitude-flat but phase-altering
all-pass response as a transparent bypass.

The validation requires the raw-minus-processed residue to approach zero when
all processing is bypassed.

## Recommended comparison sequence

For each passage:

1. Original stereo.
2. Raw Channel 2.
3. Processed Channel 2 using the recorded filter preset.
4. Channel 2 residue.
5. Raw Channel 2 again.

Record whether the proposed wording remains recognizable in the raw signal
without relying on the processed or residue condition.

## Validation

The browser validation checks:

- processing-audit mode state;
- near-zero residue under true bypass;
- expected low-frequency dominance in rumble-filter residue;
- preservation of known tones through the raw audit path.

Results must be recorded in a new browser-validation report before Phase 3 is
marked fully implemented.
# Preliminary browser-validation finding — 2026-08-05

**Status:** Superseded preliminary run; not a completed validation report.

The preliminary deterministic run reported:

- 22 passed;
- 2 failed;
- 2 pending.

The two failures had a common cause:

- the known WAV source was 48,000 Hz;
- the browser's WaveSurfer-derived analysis buffer was 8,000 Hz;
- the original test incorrectly required the decoded analysis buffer itself to
  remain at 48,000 Hz;
- a 0.50-second selection therefore contained 4,000 decoded samples rather
  than the incorrectly expected 24,000.

The duration remained exactly 4.00 seconds, both channels remained present,
and the 0.50-second selection mapped correctly to 4,000 samples at 8,000 Hz.

The same run passed:

- all four test-media integrity hashes;
- Channel 1 and Channel 2 isolation;
- stereo/mono/difference arithmetic;
- identical-channel cancellation;
- opposite-polarity cancellation and preservation;
- dB conversion;
- all preset configurations;
- WAV header and byte-length tests.

## Corrective action

The validation now distinguishes:

1. the source file's encoded sample rate; and
2. the browser-decoded analysis-buffer sample rate.

Selection boundaries are tested against elapsed time multiplied by the actual
decoded sample rate. The application now discloses that waveform-derived
statistics and raw-mix browser WAV exports use the decoded analysis buffer,
while live listening uses the media playback and Web Audio chain.

The preliminary JSON report had SHA-256:

`da6b1f7e015bcde4d2abf7252bea4ada1e192189f0ff22812a80d7ff396e133e`

It must not be presented as a passing or completed validation report because
two live test groups remained pending.
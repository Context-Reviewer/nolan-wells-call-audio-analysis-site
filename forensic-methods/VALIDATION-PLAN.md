# Browser audio-engine validation plan

**Document ID:** NW-FA-VAL-001
**Version:** 1.0
**Effective date:** 2026-08-04

## Purpose

Validate that the public browser application behaves as designed when given
known-answer test media.

This validation does not determine what words were spoken in the disputed
recording. It tests the reliability of the software used to route, select,
filter, loop, measure, and export audio.

## Test environment

Each report records:

- browser user agent;
- operating platform;
- language;
- secure-context status;
- application validation-hook version;
- test-media hashes;
- execution time;
- individual measurements and tolerances.

## Known-answer media

1. **Known stereo routing**
   - Channel 1: 440 Hz
   - Channel 2: 880 Hz
   - 48 kHz, 16-bit PCM stereo

2. **Identical-channel cancellation**
   - 1 kHz in both channels
   - Used to test difference-mode cancellation

3. **Opposite-polarity cancellation**
   - Channel 1: 1 kHz
   - Channel 2: inverted 1 kHz
   - Used to test mono cancellation and difference preservation

4. **Filter multitone**
   - 80 Hz, 500 Hz, 2200 Hz, and 8000 Hz
   - Used to measure expected preset behavior

Hashes and byte sizes are recorded in `VALIDATION-TEST-MEDIA.json`.

## Deterministic tests

- test-media integrity;
- application test-hook availability;
- media decoding properties;
- selection sample-boundary behavior;
- Channel 1 and Channel 2 export isolation;
- mono and difference arithmetic;
- opposite-polarity behavior;
- dB-to-linear-gain conversion;
- preset control values;
- WAV header, format, and byte length.

## Live Web Audio tests

- original stereo contains both known tones;
- Channel 1 routing suppresses the Channel 2 tone;
- Channel 2 routing suppresses the Channel 1 tone;
- master gain applies approximately the requested level;
- difference mode cancels identical channels;
- mild speech filtering reduces low and high bands and emphasizes presence;
- narrow speech filtering is more selective;
- rumble reduction attenuates low frequency while preserving higher bands.

## Loop test

The actual selection-loop code is run on a 0.20–0.50 second interval. The
test observes repeated backward time wraps and verifies that playback remains
within a documented tolerance around the selection.

## Result handling

A report is not considered complete while tests are marked pending.

A failed test must be investigated. Tolerances may not be widened solely to
make a failure pass. Any tolerance change must be documented in
`CHANGE-CONTROL.md`.

The downloaded JSON report must be imported with
`tools/forensic-methods/Import-ValidationReport.ps1`, committed, and linked
from the method-status record.

## Source rate versus analysis-buffer rate

The encoded test-media sample rate and the browser-decoded analysis-buffer
sample rate are separate measurements.

A browser or waveform library may decode or resample media for waveform and
sample-array operations. This is not automatically a boundary failure when:

- duration remains correct;
- channel count remains correct;
- selection duration maps to the correct number of samples at the reported
  decoded rate;
- channel arithmetic remains correct.

Every validation report must record both rates and whether resampling occurred.
The public application must disclose the decoded rate used for selection
statistics and browser WAV exports.
# Standard operating procedure

**Document ID:** NW-FA-SOP-001
**Version:** 1.0
**Effective date:** 2026-08-04

## 1. Purpose

This procedure governs the independent technical review of the publicly
circulated Sea Tow recording associated with case reference MP2607-0016.

Its purpose is to produce a neutral, documented, reproducible examination
while controlling caption priming, over-processing, and unsupported
certainty.

## 2. Source handling

1. Record the source URL, acquisition time, filename, file size, hash, and
   technical metadata.
2. Preserve the acquired source without modification.
3. Perform analysis on verified working copies.
4. Recalculate hashes after transfer or regeneration.
5. Record the parent source, command, settings, and hash for every derivative.
6. State prominently that a YouTube-derived file is not the native
   CXone/MDMR recording.

## 3. Examination order

The order below is mandatory for a controlled pass:

1. Verify the source hash.
2. Review the complete recording without disputed captions displayed.
3. Record initial observations before reviewing proposed wording.
4. Assess each channel separately.
5. Define or confirm the region of interest.
6. Listen to raw stereo.
7. Listen to raw Channel 2 centered in both ears.
8. Apply only a documented conservative preset.
9. Compare processed output directly with raw input.
10. Review the signal removed by processing when residue playback is
    available.
11. Record acoustic observations separately from wording interpretations.
12. Review model output only after human observations are recorded.
13. Reassess after a rest period when repeated listening may have caused
    perceptual fixation.
14. Apply the predefined confidence framework.
15. Submit the record for independent technical review when a reviewer is
    available.

## 4. Processing rules

- Preserve a raw comparison at all times.
- Begin with all filters bypassed.
- Prefer the least aggressive treatment that serves the stated purpose.
- Record channel routing, gain, filter type, frequency, gain, Q, dynamics
  settings, playback rate, and exact time interval.
- Do not normalize or amplify without documenting the change.
- Do not use generated speech to fill, reconstruct, or demonstrate missing
  words.
- Do not treat separation-model or ASR output as recovered evidence.
- Stop escalating processing when changes primarily increase artifacts or
  listener suggestion.

## 5. Bias controls

- Proposed wording must remain hidden during the first listening pass.
- Free-response observations precede multiple-choice comparison.
- Model prompts must not contain disputed names or favored phrases during
  exploratory screening.
- Existing public captions must not be used as ground truth.
- Contrary or unintelligible results must be retained.
- The examiner must distinguish what was heard before prompting from what
  became perceptible only afterward.

## 6. Observation records

Each region must record:

- exact start and end time;
- channel and listening mode;
- raw acoustic observations;
- masking or degradation;
- free-response wording, including unintelligible portions;
- processing used;
- alternative interpretations;
- confidence category;
- reason for the category;
- whether the result was reproducible after a rest period.

## 7. Model-assisted output

Model output is exploratory only.

- Record model name, version, command, settings, input hash, and interval.
- Preserve disagreements and null results.
- Never combine recurrent model wording with human perception and label the
  result a transcript.
- A model result cannot raise a speech conclusion above the support present
  in the audio and independent human review.

## 8. Reporting

The final report must include:

- scope;
- material examined;
- source limitations;
- hashes and technical characteristics;
- tools and versions;
- methods;
- findings and confidence categories;
- alternative interpretations;
- unresolved questions;
- review status;
- revision identifier and corresponding Git commit.

## 9. Change control

Any change to source files, processing presets, candidate boundaries,
confidence definitions, or public conclusions must be recorded in
`CHANGE-CONTROL.md`.

A revised conclusion must identify what new evidence or analysis caused the
change.

## 10. Prohibited claims

This procedure does not permit statements that:

- the native recording is authentic or unedited;
- a word was spoken with certainty when the signal does not resolve it;
- a model reconstructed the true words;
- a perceived phrase establishes conduct or intent;
- this project is an accredited or certified forensic laboratory report.
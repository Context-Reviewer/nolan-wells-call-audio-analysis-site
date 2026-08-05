# Nolan Wells Sea Tow Call Audio Analysis — Website

This repository contains the public static explainer website.

The broader working archive, intermediate derivatives, and research
materials are maintained separately.

The site presents:

- source and provenance limitations;
- channel-separation findings;
- selected raw and conservatively processed clips;
- confidence-qualified listening interpretations;
- an explanation of caption-induced auditory priming;
- reproducibility and methodological limitations.

This is not a certified forensic report.

<!-- formal-methods-phase-1-v1 -->

## Formal methods and quality controls

The repository includes a public formal-methods package containing:

- examination scope;
- evidence and derivative manifest;
- standard operating procedure;
- predefined confidence framework;
- structured observation record;
- change control;
- independent-review checklist;
- fixed report template.

Current speech conclusions are provisional pending rescore under the adopted
framework and independent review. The native CXone/MDMR export remains
unavailable.
<!-- browser-audio-validation-phase-2-v1 -->

## Browser audio validation

`validation.html` runs known-answer checks against the actual browser
selection, channel-mix, preset, gain, loop, and WAV-export code. Completed
reports are stored under `forensic-methods/validation-results/`.
<!-- browser-audio-validation-completed-20260805 -->

## Completed browser validation

The known-answer browser validation completed on 2026-08-05 with:

- 35 passed;
- 0 failed;
- 0 pending;
- overall result: pass.

The recorded environment was Chrome 151 on Windows. The result validates
the tested application behavior in that environment. It does not establish
universal behavior across all browsers and does not validate disputed speech
wording.

The run also characterized a 48 kHz encoded source and an 8 kHz
WaveSurfer-derived analysis buffer. That distinction is disclosed in the
application and report.

<!-- processing-residue-phase-3-v1 -->

## Processing-residue audit

Phase 3 adds live comparison of raw routed audio, processed audio, and the
raw-minus-processed residue. The residue is explicitly treated as a
quality-control difference signal rather than recovered speech.
<!-- processing-residue-completed-20260805 -->

### Phase 3 validation complete

The processing-residue audit completed with 41 passed, 0 failed, and
0 pending in Microsoft Edge 151 on Windows. The result validates the tested
raw, processed, and raw-minus-processed browser paths in that recorded
environment.
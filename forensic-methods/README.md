# Formal methods and quality controls

This directory records the formal procedures governing the independent review.

## Current status

Implemented in Phase 1:

- defined examination scope;
- generated source and derivative manifest;
- written standard operating procedure;
- predefined confidence framework;
- separate observation and interpretation record;
- change-control register;
- independent-review checklist;
- fixed report template.

Still pending:

- browser audio-engine validation against known signals;
- filter-residue playback;
- localized cross-channel analysis;
- controlled blind-listening data;
- independent technical review.

The absence of the native CXone/MDMR export remains an external limitation that
cannot be repaired through additional processing.
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

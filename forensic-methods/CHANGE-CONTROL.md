# Change control

All substantive changes to evidence, methods, settings, boundaries, confidence
criteria, or conclusions must be entered below.

| Date UTC | Version | Git commit | Item changed | Reason | Effect on conclusions | Author | Reviewer |
|---|---|---|---|---|---|---|---|
| 2026-08-04 | 1.0 | e62230e | Formal method framework created | Close addressable documentation and QA gaps | Existing speech findings designated provisional pending rescore and independent review | Context Reviewer | pending |
| 2026-08-05 | 1.1 | 8d3411d | Browser analysis-buffer characterization and validation correction | Preliminary validation revealed an 8 kHz WaveSurfer-derived analysis buffer despite 48 kHz encoded test media | Selection tests now use the actual decoded rate; browser statistics and export rate are disclosed; live listening remains separately tested | Context Reviewer | pending |
| 2026-08-05 | 1.2 | 8d3411d | Browser audio validation completed | 35 known-answer browser tests passed with 0 failures and 0 pending in Chrome 151 on Windows | Browser routing, gain, filters, selection arithmetic, looping, cancellation, integrity checks and WAV encoding are validated in the recorded environment | Context Reviewer | pending |
| 2026-08-05 | 1.3 | pending | Processing-residue playback implemented and validated | Make filter effects directly auditable and validate the raw, processed, and residue paths | Adds raw, processed, and raw-minus-processed audition; 41 tests passed with 0 failures and 0 pending in Edge 151 on Windows | Context Reviewer | pending |
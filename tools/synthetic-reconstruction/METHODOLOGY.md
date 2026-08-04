# Synthetic reconstruction methodology

## Purpose

The system asks speech-recognition models to produce plausible complete wording
for a selected ambiguous passage. The outputs are demonstrations of model
interpretation. They are not restored speech and are not evidence that the
generated words were spoken.

## Input variants

The selected Channel 2 passage is analyzed as:

1. raw Channel 2;
2. level-normalized Channel 2;
3. conservatively speech-focused Channel 2;
4. continuity-oriented EQ/compression Channel 2.

Every comparison file is separately published and hashed.

## Recognition lanes

Each configured model runs four passes:

- unconditioned beam search;
- context-conditioned beam search;
- unconditioned low-temperature sampling;
- context-conditioned higher-temperature sampling.

Voice-activity detection is disabled. No names, candidate phrases, expected
sentences, initial prompts, prefixes, or hotwords are supplied.

## Candidate ranking

Candidates are grouped by textual similarity and ranked using recurrence across
models, variants, and decoding passes. Support labels describe model
repeatability, not truth.

## Synthetic playback

The site uses the browser's built-in speech-synthesis voice to read each
alternative. It does not imitate the original speaker.

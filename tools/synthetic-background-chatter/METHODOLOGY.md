# High-sensitivity background-chatter methodology

The existing synthetic-reconstruction lane analyzes the selected interval as a
larger contextual unit. That is useful for dominant speech but commonly omits
fainter overlapping speakers.

This lane uses:

- Channel 2 only;
- raw, normalized, and speech-focused variants;
- 2.6-second windows with a 0.65-second hop;
- 5.2-second windows with a 1.30-second hop;
- VAD disabled;
- no initial prompt, prefix, hotwords, names, or proposed phrases;
- unconditioned beam and sampling passes;
- recurrence clustering across overlapping time windows.

The output is intentionally high sensitivity and therefore hallucination-prone.
A phrase repeated by several model runs is more reproducible, but not
necessarily true. Every candidate must be checked against raw Channel 2.

# Limitations

- The source is a YouTube transcode, not the native CXone/MDMR media file.
- The call chain may already have applied gain control, filtering, packet-loss concealment,
  echo cancellation or noise suppression.
- Telephone-band audio does not retain the full acoustic scene.
- Converting to FLAC prevents further lossy damage but does not restore discarded detail.
- Strong filtering can alter consonants and create misleading speech-like artifacts.
- Repeated listening and visible captions increase expectation bias.
- The analysis was not performed under a formal forensic laboratory protocol.
- Speaker identification, intent and event reconstruction are outside the scope of this
  repository.

The strongest future improvement would be obtaining the native file released by MDMR,
including original container metadata and an independently documented chain of custody.

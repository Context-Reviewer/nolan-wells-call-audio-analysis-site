# Provenance

## Publicly circulated source

- YouTube video ID: `oshE23g-rTY`
- Title at download: `EP 4: Completely RAW Nolan Wells' friends Sea Tow 3:48 PM distress call on July 4, 2026 - MDMR to me`
- Uploader: `PLUNDER True Crime`
- Downloaded audio format: WebM/Opus, format ID 251
- Claimed source filename displayed by the uploader:

```text
CXone recording_Victoria Garcia_2026-07-04_21-48[UTC]_29427a8b-5b62-45b9-81c1-e95148784c4c_01.mp4
```

The uploader stated that the recording was received directly from MDMR. This repository
preserves that claim as provenance information but does not independently verify the
chain of custody.

## Important distinction

`source/Nolan-Wells-SeaTow.source.webm` is YouTube's encoded audio stream. It is not the
claimed native CXone MP4 and should not be described as the original MDMR file.

## Metadata sanitization

The full `yt-dlp` information JSON contained transient signed media URLs, request headers
and an IP address embedded in a playback URL. Those fields were excluded from
`source/source-info.sanitized.json` to avoid publishing private and short-lived download
information.

## Hashing

`provenance/SHA256SUMS.txt` hashes the repository package before Git LFS transforms media
files into pointer objects. Hashes can be verified with:

```powershell
Get-Content .\provenance\SHA256SUMS.txt | ForEach-Object {
    $parts = $_ -split '  ', 2
    if ($parts.Count -eq 2) {
        $expected = $parts[0]
        $path = Join-Path $PWD $parts[1]
        $actual = (Get-FileHash -Algorithm SHA256 $path).Hash.ToLowerInvariant()
        [pscustomobject]@{ Path = $parts[1]; Match = ($actual -eq $expected) }
    }
}
```

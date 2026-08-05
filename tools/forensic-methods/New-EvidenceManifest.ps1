[CmdletBinding()]
param(
    [string]$SiteRoot = (
        Split-Path -Parent (
            Split-Path -Parent $PSScriptRoot
        )
    )
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$AudioRoot = Join-Path $SiteRoot "assets\audio"
$OutputPath = Join-Path `
    $SiteRoot `
    "forensic-methods\EVIDENCE-MANIFEST.json"

if (-not (Test-Path -LiteralPath $AudioRoot)) {
    throw "Audio directory was not found: $AudioRoot"
}

$Ffprobe = Get-Command `
    ffprobe `
    -ErrorAction SilentlyContinue

$GitCommit = $null

try {
    $GitCommit = (
        git -C $SiteRoot rev-parse HEAD
    ).Trim()
}
catch {
    $GitCommit = $null
}

$ItemCounter = 0

$Items = foreach ($File in (
    Get-ChildItem `
        -LiteralPath $AudioRoot `
        -File `
        -Recurse |
    Sort-Object FullName
)) {
    $Relative = [System.IO.Path]::GetRelativePath(
        $SiteRoot,
        $File.FullName
    ).Replace("\", "/")

    $Probe = $null

    if ($Ffprobe) {
        try {
            $ProbeText = & $Ffprobe.Source `
                -v error `
                -show_format `
                -show_streams `
                -of json `
                $File.FullName

            if ($LASTEXITCODE -eq 0 -and $ProbeText) {
                $RawProbe = (
                    $ProbeText -join [Environment]::NewLine |
                    ConvertFrom-Json
                )

                $Probe = [ordered]@{
                    format_name = $RawProbe.format.format_name
                    duration_seconds = if (
                        $RawProbe.format.duration
                    ) {
                        [double]$RawProbe.format.duration
                    }
                    else {
                        $null
                    }
                    bit_rate = if (
                        $RawProbe.format.bit_rate
                    ) {
                        [long]$RawProbe.format.bit_rate
                    }
                    else {
                        $null
                    }
                    streams = @(
                        foreach ($Stream in $RawProbe.streams) {
                            [ordered]@{
                                index = $Stream.index
                                codec_type = $Stream.codec_type
                                codec_name = $Stream.codec_name
                                sample_rate_hz = if (
                                    $Stream.sample_rate
                                ) {
                                    [int]$Stream.sample_rate
                                }
                                else {
                                    $null
                                }
                                channels = $Stream.channels
                                # optional-ffprobe-properties-v1
                                channel_layout = if (
                                    $Stream.PSObject.Properties.Name -contains
                                    "channel_layout"
                                ) {
                                    $Stream.channel_layout
                                }
                                else {
                                    $null
                                }
                            }
                        }
                    )
                }
            }
        }
        catch {
            $Probe = [ordered]@{
                error = $_.Exception.Message
            }
        }
    }

    $ItemCounter += 1

    [ordered]@{
        item_id = "AUDIO-" + $ItemCounter.ToString("000")
        path = $Relative
        filename = $File.Name
        bytes = $File.Length
        last_write_utc = $File.LastWriteTimeUtc.ToString("o")
        sha256 = (
            Get-FileHash `
                -LiteralPath $File.FullName `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()
        media_probe = $Probe
    }
}

$Manifest = [ordered]@{
    schema = "nolan_wells_evidence_manifest_v1"
    generated_utc = (
        Get-Date
    ).ToUniversalTime().ToString("o")
    case_id = "MP2607-0016-PUBLIC-AUDIO-REVIEW"
    repository_commit = $GitCommit
    acquisition = [ordered]@{
        public_source_url = "https://www.youtube.com/watch?v=oshE23g-rTY"
        claimed_original_filename = "CXone recording_Victoria Garcia_2026-07-04_21-48[UTC]_29427a8b-5b62-45b9-81c1-e95148784c4c_01.mp4"
        native_export_obtained = $false
        relationship_to_native = "Derivative; publicly circulated YouTube-derived recording."
        chain_of_custody_before_publication = "Not established."
    }
    tool_environment = [ordered]@{
        powershell = $PSVersionTable.PSVersion.ToString()
        ffprobe = if ($Ffprobe) {
            (& $Ffprobe.Source -version | Select-Object -First 1)
        }
        else {
            $null
        }
    }
    items = @($Items)
}

$Json = $Manifest |
    ConvertTo-Json -Depth 12

[System.IO.File]::WriteAllText(
    $OutputPath,
    $Json + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Evidence manifest written:"
Write-Host $OutputPath
Write-Host "Items:" @($Items).Count
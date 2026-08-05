[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ReportPath,

    [string]$SiteRoot = (
        Split-Path -Parent (
            Split-Path -Parent $PSScriptRoot
        )
    )
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ResolvedReport = (
    Resolve-Path -LiteralPath $ReportPath
).Path

$Report = Get-Content `
    -LiteralPath $ResolvedReport `
    -Raw |
    ConvertFrom-Json

if (
    $Report.schema -ne
    "nolan_wells_browser_audio_validation_v1"
) {
    throw "Unexpected validation-report schema."
}

if ($Report.summary.pending -ne 0) {
    throw (
        "The report is incomplete: " +
        "$($Report.summary.pending) test(s) are pending."
    )
}

$DestinationRoot = Join-Path `
    $SiteRoot `
    "forensic-methods\validation-results"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $DestinationRoot |
    Out-Null

$SafeTimestamp = (
    [datetime]$Report.generatedAtUtc
).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")

$Destination = Join-Path `
    $DestinationRoot `
    "browser-audio-validation-$SafeTimestamp.json"

Copy-Item `
    -LiteralPath $ResolvedReport `
    -Destination $Destination `
    -Force

$Hash = (
    Get-FileHash `
        -LiteralPath $Destination `
        -Algorithm SHA256
).Hash.ToLowerInvariant()

$SummaryPath = Join-Path `
    $DestinationRoot `
    "LATEST.md"

$Summary = @"
# Latest browser audio validation

- Generated UTC: $($Report.generatedAtUtc)
- Overall result: **$($Report.summary.overall)**
- Passed: $($Report.summary.passed)
- Failed: $($Report.summary.failed)
- Pending: $($Report.summary.pending)
- Browser: $($Report.environment.userAgent)
- Report: ``$(Split-Path -Leaf $Destination)``
- SHA-256: ``$Hash``

A passing browser validation establishes that the website behaved as designed
in the recorded environment. It does not validate speech interpretations.
"@

[System.IO.File]::WriteAllText(
    $SummaryPath,
    $Summary,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Imported validation report:"
Write-Host $Destination
Write-Host "SHA-256:"
Write-Host $Hash

if ($Report.summary.failed -gt 0) {
    Write-Warning (
        "The report contains " +
        "$($Report.summary.failed) failed test(s)."
    )
}

[CmdletBinding()]
param(
    [string]$SiteRoot = "C:\dev\Nolan_Wells\nolan-wells-call-audio-analysis-site",

    [double]$Start = 0,

    [double]$End = 18,

    [double]$ContextPadding = 2,

    [string]$PrimaryModel = "large-v3",

    [string]$SecondaryModel = "small.en",

    [ValidateSet("auto", "cpu", "cuda")]
    [string]$Device = "auto",

    [switch]$Quick,

    [switch]$SkipModelFileHashes,

    [switch]$Preview
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Path {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description was not found: $Path"
    }
}

if ($End -le $Start) {
    throw "-End must be greater than -Start."
}

Require-Path -Path $SiteRoot -Description "Site repository"
Require-Path -Path (Join-Path $SiteRoot ".git") -Description "Git repository"

$SourceCandidates = @(
    (Join-Path $SiteRoot "assets\audio\full-recording-source.webm"),
    (Join-Path $SiteRoot "assets\audio\full-recording.mp3")
)

$Source = $SourceCandidates |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1

if (-not $Source) {
    throw "The preserved full recording was not found."
}

$VenvPython = Join-Path $SiteRoot ".venv-phonetic\Scripts\python.exe"
Require-Path -Path $VenvPython -Description "Existing phonetic virtual environment"

foreach ($CommandName in @("ffmpeg", "ffprobe")) {
    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "$CommandName was not found in PATH."
    }
}

$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$GeneratorSource = Join-Path $PackageRoot "generator"
Require-Path -Path $GeneratorSource -Description "Generator folder"

$ToolRoot = Join-Path $SiteRoot "tools\synthetic-reconstruction"
$DataRoot = Join-Path $SiteRoot "assets\data"
$AudioRoot = Join-Path $SiteRoot "assets\audio\synthetic-reconstruction"
$WorkRoot = Join-Path $SiteRoot ".synthetic-reconstruction-work"
$ModelCache = Join-Path $SiteRoot ".model-cache"
$BackupRoot = Join-Path $SiteRoot (
    "backup-before-synthetic-reconstruction-" +
    (Get-Date -Format "yyyyMMdd-HHmmss")
)

foreach ($Path in @(
    $ToolRoot,
    $DataRoot,
    $AudioRoot,
    $WorkRoot,
    $ModelCache,
    $BackupRoot
)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

foreach ($Name in @("app.js", "styles.css", "index.html")) {
    Copy-Item `
        -LiteralPath (Join-Path $SiteRoot $Name) `
        -Destination (Join-Path $BackupRoot $Name)
}

foreach ($Name in @(
    "generate_reconstruction.py",
    "patch_site.py",
    "METHODOLOGY.md"
)) {
    Copy-Item `
        -LiteralPath (Join-Path $GeneratorSource $Name) `
        -Destination (Join-Path $ToolRoot $Name) `
        -Force
}

$InstalledRunner = Join-Path $ToolRoot "RUN-SYNTHETIC-RECONSTRUCTION.ps1"

if (
    [System.IO.Path]::GetFullPath($MyInvocation.MyCommand.Path) -ne
    [System.IO.Path]::GetFullPath($InstalledRunner)
) {
    Copy-Item `
        -LiteralPath $MyInvocation.MyCommand.Path `
        -Destination $InstalledRunner `
        -Force
}

$GitIgnorePath = Join-Path $SiteRoot ".gitignore"
$RequiredIgnores = @(
    ".synthetic-reconstruction-work/",
    "backup-before-synthetic-reconstruction-*"
)

$ExistingIgnores = @()
if (Test-Path -LiteralPath $GitIgnorePath) {
    $ExistingIgnores = @(Get-Content -LiteralPath $GitIgnorePath)
}

foreach ($Ignore in $RequiredIgnores) {
    if ($ExistingIgnores -notcontains $Ignore) {
        Add-Content -LiteralPath $GitIgnorePath -Value $Ignore
    }
}

Write-Host ""
Write-Host "Installing synthetic reconstruction tab..."

& $VenvPython `
    (Join-Path $ToolRoot "patch_site.py") `
    --site-root $SiteRoot

if ($LASTEXITCODE -ne 0) {
    throw "Website patching failed."
}

$OutputJson = Join-Path $DataRoot "synthetic-reconstruction.json"

$EffectivePrimary = $PrimaryModel
$UseSecondary = $true

if ($Quick) {
    $EffectivePrimary = "small.en"
    $UseSecondary = $false
}

$Invariant = [System.Globalization.CultureInfo]::InvariantCulture

$Arguments = @(
    (Join-Path $ToolRoot "generate_reconstruction.py"),
    "--source", $Source,
    "--output", $OutputJson,
    "--audio-output-dir", $AudioRoot,
    "--work-dir", $WorkRoot,
    "--model-cache", $ModelCache,
    "--start", $Start.ToString($Invariant),
    "--end", $End.ToString($Invariant),
    "--context-padding", $ContextPadding.ToString($Invariant),
    "--primary-model", $EffectivePrimary,
    "--secondary-model", $SecondaryModel,
    "--device", $Device
)

if (-not $UseSecondary) {
    $Arguments += "--skip-secondary"
}

if ($SkipModelFileHashes) {
    $Arguments += "--skip-model-file-hashes"
}

$env:HF_HOME = Join-Path $ModelCache "huggingface-home"
$env:HF_HUB_DISABLE_TELEMETRY = "1"
$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"
$env:DO_NOT_TRACK = "1"
$env:TOKENIZERS_PARALLELISM = "false"

Write-Host ""
Write-Host "Source:           $Source"
Write-Host "Selection:        $Start - $End seconds"
Write-Host "Context padding:  $ContextPadding seconds"
Write-Host "Primary model:    $EffectivePrimary"
Write-Host "Secondary model:  $(if ($UseSecondary) { $SecondaryModel } else { '[skipped]' })"
Write-Host "Device:           $Device"
Write-Host ""
Write-Host "Generating synthetic interpretation candidates..."
Write-Host ""

& $VenvPython @Arguments

if ($LASTEXITCODE -ne 0) {
    throw "Synthetic reconstruction generation failed."
}

$IndexPath = Join-Path $SiteRoot "index.html"
$Index = [System.IO.File]::ReadAllText($IndexPath)
$CacheToken = "synthetic-" + (Get-Date -Format "yyyyMMddHHmmss")

$Index = [regex]::Replace(
    $Index,
    'href="\./styles\.css(?:\?[^"]*)?"',
    "href=`"./styles.css?v=$CacheToken`""
)

$Index = [regex]::Replace(
    $Index,
    'src="\./app\.js(?:\?[^"]*)?"',
    "src=`"./app.js?v=$CacheToken`""
)

[System.IO.File]::WriteAllText(
    $IndexPath,
    $Index,
    [System.Text.UTF8Encoding]::new($false)
)

Set-Location -LiteralPath $SiteRoot

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    & $Node.Source --check (Join-Path $SiteRoot "app.js")

    if ($LASTEXITCODE -ne 0) {
        throw "JavaScript syntax validation failed."
    }

    Write-Host "JavaScript syntax: OK"
}

Write-Host ""
Write-Host "Generated:"
Write-Host $OutputJson
Write-Host ""
Write-Host "Published comparison audio:"
Get-ChildItem -LiteralPath $AudioRoot -Filter "*.mp3" |
    Select-Object Name, Length
Write-Host ""

git status --short
git diff --check

if ($Preview) {
    Write-Host ""
    Write-Host "Preview: http://localhost:8000/#full-recording"
    Write-Host "Press Ctrl+C to stop."

    Start-Process "http://localhost:8000/#full-recording"
    & $VenvPython -m http.server 8000 --directory $SiteRoot
}

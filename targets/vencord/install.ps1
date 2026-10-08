# Prayer Times Break — Discord (Vencord) plugin setup for Windows.
#
# Double-click install.cmd, or run: powershell -ExecutionPolicy Bypass -File install.ps1
# Without this repository (PowerShell):
#   iwr -useb https://raw.githubusercontent.com/mPhpMaster/prayer-times-reminder-chrome-ext/main/targets/vencord/install.ps1 -OutFile $env:TEMP\ptb-install.ps1
#   powershell -ExecutionPolicy Bypass -File $env:TEMP\ptb-install.ps1
#
# Installs what is missing (Git, Node.js 22+, pnpm) with winget, then runs
# installer.mjs, which installs, updates or removes the plugin (and Vencord).
# Extra arguments go to installer.mjs (--install, --update, --remove, --status, --yes).

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$RepoUrl = 'https://github.com/mPhpMaster/prayer-times-reminder-chrome-ext.git'
$Ar = (Get-UICulture).Name -like 'ar*'
$env:PTB_LANG = if ($Ar) { 'ar' } else { 'en' }

function Say([string]$En, [string]$ArText) { if ($Ar) { Write-Host $ArText -ForegroundColor Cyan } else { Write-Host $En -ForegroundColor Cyan } }
function Has([string]$Cmd) { [bool](Get-Command $Cmd -ErrorAction SilentlyContinue) }
function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Fail([string]$En, [string]$ArText) { Say $En $ArText; exit 1 }
function Winget-Install([string]$Id) {
    if (-not (Has 'winget')) {
        Fail "winget isn't available. Install `"App Installer`" from the Microsoft Store, then run this again." `
             "الأداة winget غير متوفرة. ثبّت «App Installer» من متجر مايكروسوفت ثم شغّل هذا مرة أخرى."
    }
    winget install --id $Id -e --silent --accept-source-agreements --accept-package-agreements
    Refresh-Path
}
function Node-Major { if (Has 'node') { [int](((node -v) -replace '^v', '').Split('.')[0]) } else { 0 } }

# 1. Git
if (-not (Has 'git')) {
    Say 'Installing Git...' 'جارٍ تثبيت Git...'
    Winget-Install 'Git.Git'
    if (-not (Has 'git')) { Fail 'Git was installed; close this window and run the setup again.' 'تم تثبيت Git؛ أغلق هذه النافذة وشغّل الإعداد مرة أخرى.' }
}

# 2. Node.js 22 or newer (Vencord needs it)
if ((Node-Major) -lt 22) {
    Say 'Installing Node.js (LTS)...' 'جارٍ تثبيت Node.js (LTS)...'
    Winget-Install 'OpenJS.NodeJS.LTS'
    if ((Node-Major) -lt 22) {
        winget upgrade --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
        Refresh-Path
    }
    if ((Node-Major) -lt 22) { Fail 'Node.js 22+ is needed; close this window and run the setup again.' 'يلزم Node.js 22 أو أحدث؛ أغلق هذه النافذة وشغّل الإعداد مرة أخرى.' }
}

# 3. pnpm (Vencord's package manager)
if (-not (Has 'pnpm')) {
    Say 'Installing pnpm...' 'جارٍ تثبيت pnpm...'
    npm install -g pnpm
    Refresh-Path
    if (-not (Has 'pnpm')) { $env:Path += ";$env:APPDATA\npm" }
}

# 4. The plugin's source: this repository, or a fresh copy of it
$Root = $null
if ($PSScriptRoot) {
    $Candidate = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    if (Test-Path (Join-Path $Candidate 'tools\sync-core.mjs')) { $Root = $Candidate }
}
if (-not $Root) {
    Say 'Downloading the plugin...' 'جارٍ تنزيل الإضافة...'
    $Root = Join-Path $env:TEMP 'prayer-times-break-src'
    if (Test-Path $Root) { Remove-Item $Root -Recurse -Force }
    git clone --depth 1 $RepoUrl $Root
    if ($LASTEXITCODE -ne 0) { Fail 'Download failed; check the internet connection.' 'فشل التنزيل؛ تحقّق من الاتصال بالإنترنت.' }
}

& node (Join-Path $Root 'targets\vencord\installer.mjs') @args
exit $LASTEXITCODE

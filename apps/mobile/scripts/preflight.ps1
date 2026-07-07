# Validates Metro/monorepo setup before expo start or APK build.
$ErrorActionPreference = "Stop"

$mobileRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path (Split-Path $mobileRoot -Parent) -Parent

& (Join-Path $PSScriptRoot "ensure-expo-router-link.ps1")

$failures = @()

function Require-FileContent {
    param([string]$Path, [string]$Pattern, [string]$Message)
    if (-not (Test-Path $Path)) {
        $script:failures += "Missing file: $Path - $Message"
        return
    }
    $content = Get-Content $Path -Raw
    if ($content -notmatch $Pattern) {
        $script:failures += $Message
    }
}

Require-FileContent (Join-Path $mobileRoot "babel.config.js") "reanimated/plugin" "babel.config.js must include react-native-reanimated/plugin (last plugin)."
Require-FileContent (Join-Path $mobileRoot "metro.config.js") "assetExts" "metro.config.js must configure resolver.assetExts (wasm for expo-sqlite)."
Require-FileContent (Join-Path $mobileRoot "metro.config.js") "@setlist-ultra/core" "metro.config.js must map @setlist-ultra/* via extraNodeModules."
Require-FileContent (Join-Path $mobileRoot "metro.config.js") "blockList" "metro.config.js must blockList android/build (Windows Metro watcher)."

$corePkg = Join-Path $repoRoot "packages\core\package.json"
$dbPkg = Join-Path $repoRoot "packages\db\package.json"
if (-not (Test-Path $corePkg)) { $failures += "Missing packages/core - run npm install from repo root." }
if (-not (Test-Path $dbPkg)) { $failures += "Missing packages/db - run npm install from repo root." }

$envFile = Join-Path $mobileRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Warning ".env not found - copy .env.example to apps/mobile/.env"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Preflight FAILED:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "See docs/BUILD.md" -ForegroundColor Yellow
    exit 1
}

Write-Host "Preflight OK - Metro/monorepo config looks good."

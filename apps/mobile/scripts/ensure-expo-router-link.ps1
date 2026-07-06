# Ensures expo-router resolves from repo root (npm workspaces hoisting gap).
$ErrorActionPreference = "Stop"

$mobileRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path (Split-Path $mobileRoot -Parent) -Parent
$target = Join-Path $repoRoot "apps\mobile\node_modules\expo-router"
$link = Join-Path $repoRoot "node_modules\expo-router"

if (-not (Test-Path $target)) {
    Write-Warning "expo-router not installed in apps/mobile yet; run npm install from repo root."
    exit 0
}

if (Test-Path $link) {
    exit 0
}

New-Item -ItemType Junction -Path $link -Target $target | Out-Null
Write-Host "Linked $link -> $target"

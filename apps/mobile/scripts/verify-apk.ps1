# Ensures a release APK embeds a JS bundle (standalone installable).
param(
    [Parameter(Mandatory = $true)][string]$ApkPath,
    [switch]$AllowDebug
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ApkPath)) {
    Write-Error "APK not found: $ApkPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ApkPath).Path)
try {
    $bundle = $zip.Entries | Where-Object {
        $_.FullName -match 'assets/.*\.bundle$' -or $_.FullName -eq 'assets/index.android.bundle'
    } | Select-Object -First 1

    if (-not $bundle) {
        if ($AllowDebug) {
            Write-Warning "No JS bundle in APK (expected for debug builds that need Metro)."
            exit 0
        }
        Write-Error @"
APK has no embedded JS bundle — it will NOT start on a phone without Metro.

This is a debug APK or a failed release build. Ship assembleRelease only.
See docs/BUILD.md
"@
    }

    $sizeKb = [math]::Round($bundle.Length / 1KB, 1)
    Write-Host "APK OK: embedded bundle $($bundle.FullName) ($sizeKb KB)"
} finally {
    $zip.Dispose()
}

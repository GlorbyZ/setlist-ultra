# Local Android APK build (no Expo cloud / EAS required)
$ErrorActionPreference = "Stop"

$javaHome = "C:\Program Files\Eclipse Adoptium\jdk-17.0.10.7-hotspot"
$androidHome = "C:\Users\epicn\AppData\Local\Android\Sdk"

if (-not (Test-Path $javaHome)) {
    Write-Error "JDK 17 not found at $javaHome. Install Eclipse Temurin 17 or update this script."
}
if (-not (Test-Path $androidHome)) {
    Write-Error "Android SDK not found at $androidHome. Install Android Studio or update this script."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

$mobileRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path (Split-Path $mobileRoot -Parent) -Parent

# Windows MAX_PATH: native CMake builds fail under long paths (e.g. .../node_modules/.../RNGestureHandler...).
$buildRoot = $mobileRoot
$substDrive = "S:"
$substPath = (Resolve-Path $repoRoot).Path
if ($substPath.Length -gt 40) {
    $existing = subst 2>&1 | Select-String "$substDrive\\"
    if (-not $existing) {
        Write-Host "Mapping $substDrive -> $substPath (avoids Windows 260-char path limit)"
        subst $substDrive $substPath | Out-Null
    }
    $buildRoot = "$substDrive\apps\mobile"
}

if (-not (Test-Path "$buildRoot\android")) {
    Write-Host "Running expo prebuild..."
    Push-Location $buildRoot
    $env:CI = "1"
    npx expo prebuild --platform android
    Pop-Location
}

$release = $args -notcontains "--debug"
$gradleTask = if ($release) { "assembleRelease" } else { "assembleDebug" }
$variant = if ($release) { "release" } else { "debug" }
$apkName = if ($release) { "app-release.apk" } else { "app-debug.apk" }

Write-Host "Building $variant APK from $buildRoot..."
Push-Location "$buildRoot\android"
& .\gradlew.bat $gradleTask
$exit = $LASTEXITCODE
Pop-Location

if ($exit -ne 0) { exit $exit }

$apkPath = Join-Path $buildRoot "android\app\build\outputs\apk\$variant\$apkName"
if (-not (Test-Path $apkPath)) {
    Write-Error "Build finished but APK not found at $apkPath"
}

$releases = Join-Path $repoRoot "releases"
New-Item -ItemType Directory -Force -Path $releases | Out-Null
$dest = Join-Path $releases "setlist-ultra-0.1.0-$variant.apk"
Copy-Item $apkPath $dest -Force
$githubApk = Join-Path $releases "setlist-ultra-android.apk"
if ($release) {
    Copy-Item $apkPath $githubApk -Force
}

Write-Host ""
Write-Host "APK built successfully:"
Write-Host "  $apkPath"
Write-Host "  $dest"

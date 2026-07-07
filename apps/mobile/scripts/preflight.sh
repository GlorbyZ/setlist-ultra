#!/usr/bin/env bash
# Validates Metro/monorepo setup before expo start or APK build (Linux/macOS/CI).
set -euo pipefail

mobile_root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "$mobile_root/../.." && pwd)"
failures=0

bash "$(dirname "$0")/ensure-expo-router-link.sh"

require_pattern() {
  local file="$1" pattern="$2" msg="$3"
  if [[ ! -f "$file" ]]; then
    echo "FAIL: missing $file — $msg"
    failures=$((failures + 1))
    return
  fi
  if ! grep -qE "$pattern" "$file"; then
    echo "FAIL: $msg"
    failures=$((failures + 1))
  fi
}

require_pattern "$mobile_root/babel.config.js" 'reanimated/plugin' \
  "babel.config.js must include react-native-reanimated/plugin"
require_pattern "$mobile_root/metro.config.js" 'assetExts' \
  "metro.config.js must configure assetExts (wasm for expo-sqlite)"
require_pattern "$mobile_root/metro.config.js" '@setlist-ultra/core' \
  "metro.config.js must map @setlist-ultra/* via extraNodeModules"
require_pattern "$mobile_root/metro.config.js" 'android.*build' \
  "metro.config.js must blockList android/build"

[[ -f "$repo_root/packages/core/package.json" ]] || { echo "FAIL: missing packages/core"; failures=$((failures + 1)); }
[[ -f "$repo_root/packages/db/package.json" ]] || { echo "FAIL: missing packages/db"; failures=$((failures + 1)); }

if [[ $failures -gt 0 ]]; then
  echo ""
  echo "Preflight failed ($failures). See docs/BUILD.md"
  exit 1
fi

echo "Preflight OK — Metro/monorepo config looks good."

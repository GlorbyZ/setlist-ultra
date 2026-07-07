#!/usr/bin/env bash
# Ensures a release APK embeds a JS bundle (standalone installable).
set -euo pipefail

apk_path="${1:?Usage: verify-apk.sh <path-to.apk>}"
allow_debug="${2:-}"

if [[ ! -f "$apk_path" ]]; then
  echo "APK not found: $apk_path" >&2
  exit 1
fi

if unzip -l "$apk_path" | grep -qE 'assets/.*\.bundle'; then
  bundle_line="$(unzip -l "$apk_path" | grep -E 'assets/.*\.bundle' | head -1)"
  echo "APK OK: embedded bundle — $bundle_line"
  exit 0
fi

if [[ "$allow_debug" == "--allow-debug" ]]; then
  echo "WARN: No JS bundle (expected for debug APKs that need Metro)."
  exit 0
fi

echo "FAIL: APK has no embedded JS bundle — it will NOT start on a phone without Metro." >&2
echo "Ship assembleRelease only. See docs/BUILD.md" >&2
exit 1

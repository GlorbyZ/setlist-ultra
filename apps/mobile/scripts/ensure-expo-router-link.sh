#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
target="$repo_root/apps/mobile/node_modules/expo-router"
link="$repo_root/node_modules/expo-router"

if [[ ! -d "$target" ]]; then
  echo "expo-router not installed in apps/mobile; run npm install from repo root." >&2
  exit 0
fi

if [[ -e "$link" ]]; then
  exit 0
fi

mkdir -p "$repo_root/node_modules"
ln -s "../apps/mobile/node_modules/expo-router" "$link"
echo "Linked $link -> $target"

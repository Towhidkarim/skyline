#!/usr/bin/env bash
# Day and night close-ups of one street, for before/after art checks (Orca, dev server running).
# Usage: tools/dev/street-shot.sh <name> [space=34] [zoom=2.2]
# Writes .shots/<name>-day.png and .shots/<name>-night.png.
set -euo pipefail
name=${1:?name}
space=${2:-34}
zoom=${3:-2.2}
page=$(orca tab create --url "http://localhost:5173/?demo=play&seed=4" --json | grep -o '"browserPageId": "[^"]*"' | cut -d'"' -f4)
trap 'orca tab close --page "$page" --json >/dev/null 2>&1 || true' EXIT
orca wait --time 8000 --page "$page" --json >/dev/null 2>&1 || true
for sky in day night; do
  level=$([ "$sky" = day ] && echo 0 || echo 1)
  for _ in 1 2; do
    orca eval --page "$page" --json --expression "(()=>{const b=skylineStore.board; b.skipAnimations(); b.setNight($level,true); b.focus($space,$zoom,true); return 1})()" >/dev/null
    orca wait --time 600 --page "$page" --json >/dev/null 2>&1 || true
  done
  orca wait --time 2500 --page "$page" --json >/dev/null 2>&1 || true
  pnpm -s shot "$name-$sky" --page "$page" | tail -1
done

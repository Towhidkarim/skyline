#!/usr/bin/env bash
# A dusk-to-night timelapse of the city, rendered frame by frame in Orca (DOM UI and board overlays
# hidden). The board's clock is paused and stepped one frame at a time, so the result is smooth no
# matter how slow the capture is.
# Usage: tools/dev/city-anim.sh [name=city-anim] [frames=72] [fps=15] [from=0.1] [to=1] [zoom=1.5]
# Writes .shots/<name>-frames/*.png, then .shots/<name>.webp and .shots/<name>.gif.
set -euo pipefail
name=${1:-city-anim}
frames=${2:-72}
fps=${3:-15}
from=${4:-0.1}
to=${5:-1}
zoom=${6:-1.5}
step=$((1000 / fps))
dir=".shots/$name-frames"
rm -rf "$dir" && mkdir -p "$dir"
page=$(orca tab create --url "http://localhost:${PORT:-5173}/?demo=play&seed=7" --json | grep -o '"browserPageId": "[^"]*"' | cut -d'"' -f4)
trap 'orca tab close --page "$page" --json >/dev/null 2>&1 || true' EXIT
orca tab switch --page "$page" >/dev/null
orca wait --time 6000 --page "$page" --json >/dev/null 2>&1 || true
orca exec --page "$page" --command "set viewport 1200 680" >/dev/null 2>&1
orca wait --time 1500 --page "$page" --json >/dev/null 2>&1 || true
# Hide the shell and overlays first: the board re-centers when the shell's insets change, so the
# framing waits until that has settled. Then frame the city, pause the clock and start the fade.
orca eval --page "$page" --json --expression "(()=>{for(const el of document.querySelectorAll('body *')){if(el.tagName!=='CANVAS'&&!el.querySelector('canvas'))el.style.visibility='hidden'};const b=skylineStore.board;b.setOdds(null);b.setActive(null);b.marker.container.visible=false;b.setNight($from,true);return 1})()" >/dev/null
orca wait --time 2000 --page "$page" --json >/dev/null 2>&1 || true
orca eval --page "$page" --json --expression "(()=>{const b=skylineStore.board;b.setInsets({top:0,right:0,bottom:0,left:0});const c=b.camera,k=c.bounds;c.focusOn((k.minX+k.maxX)/2,(k.minY+k.maxY)/2+30,$zoom,true);const tk=b.app.ticker;tk.stop();window.__t=performance.now();for(let i=0;i<30;i++){window.__t+=$step;tk.update(window.__t)}b.setNight($to);return 1})()" >/dev/null
for i in $(seq -w 1 "$frames"); do
  orca eval --page "$page" --json --expression "(()=>{window.__t+=$step;skylineStore.board.app.ticker.update(window.__t);return 1})()" >/dev/null
  pnpm -s shot "$name-frames/$i" --page "$page" >/dev/null
done
python -X utf8 -I tools/dev/frames-to-anim.py "$dir" ".shots/$name" "$fps"

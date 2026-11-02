#!/usr/bin/env sh
# City art at a given time of day in Orca, DOM UI and board overlays (odds, turn marker) hidden: tools/dev/city-shot.sh <name> [night 0..1] [zoom] [dx dy]
# Zoom is a factor of the fit zoom (1 = whole board); dx, dy shift the view from the board center
# in world pixels. PORT=5199 picks another dev server. Opens its own tab on the demo game, saves
# .shots/<name>.png, closes the tab.
name=${1:-city}; night=${2:-0}; zoom=${3:-1}; dx=${4:-0}; dy=${5:-0}
port=${PORT:-5173}
page=$(orca tab create --url "http://localhost:$port/?demo=play&seed=7" --json | grep -o '"browserPageId": "[^"]*"' | cut -d'"' -f4)
sleep 5
orca tab switch --page "$page" >/dev/null
orca exec --page "$page" --command "set viewport 1300 900" >/dev/null 2>&1
orca eval --page "$page" --json --expression "(()=>{for(const el of document.querySelectorAll('body *')){if(el.tagName!=='CANVAS'&&!el.querySelector('canvas'))el.style.visibility='hidden'};const b=skylineStore.board;b.setOdds(null);b.setActive(null);b.marker.container.visible=false;b.setNight($night,true);const c=b.camera,k=c.bounds;c.focusOn((k.minX+k.maxX)/2+$dx,(k.minY+k.maxY)/2+$dy,$zoom,true);return 1})()" >/dev/null
sleep 2
pnpm -s shot "$name" --page "$page" >/dev/null
orca tab close --page "$page" --json >/dev/null
echo ".shots/$name.png"

"""Frames (PNG, sorted by name) to a looping animated WebP and GIF. Used by city-anim.sh.

Usage: python -X utf8 -I tools/dev/frames-to-anim.py <frames-dir> <out-base> <fps> [width=900]
Writes <out-base>.webp and <out-base>.gif; the last frame holds a little longer before the loop.
"""

import sys
from pathlib import Path

from PIL import Image

src, out, fps = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3])
width = int(sys.argv[4]) if len(sys.argv) > 4 else 900
frames = []
for p in sorted(src.glob("*.png")):
    im = Image.open(p).convert("RGB")
    frames.append(im.resize((width, round(im.height * width / im.width)), Image.LANCZOS))
ms = round(1000 / fps)
durations = [ms] * (len(frames) - 1) + [1200]
frames[0].save(
    out + ".webp", save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=82, method=6
)
# The GIF shares one palette, so colors stay steady from frame to frame.
palette = frames[len(frames) // 2].quantize(colors=255, method=Image.MEDIANCUT)
gif = [f.quantize(palette=palette, dither=Image.FLOYDSTEINBERG) for f in frames]
gif[0].save(out + ".gif", save_all=True, append_images=gif[1:], duration=durations, loop=0, optimize=True)
for ext in ("webp", "gif"):
    print(f"{out}.{ext}: {Path(out + '.' + ext).stat().st_size / 1e6:.1f} MB, {len(frames)} frames")

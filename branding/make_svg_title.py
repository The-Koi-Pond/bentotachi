# Turns the drawn "Bentotachi" title (BentotachiTitle.png) into clean SVGs:
# bentotachi-title.svg (dark letters) and bentotachi-title-dark.svg (cream
# letters, for dark mode).
#
# The letters, flower and leaf are traced with Inkscape (1.4, its own
# potrace) from masks that are enlarged and smoothed first, so the curves come
# out smooth. The chopstick and the leaf's vein are drawn here, as they're
# simple shapes. Coordinates are the PNG's own (703 x 228).
#
#   python make_svg_title.py BentotachiTitle.png <output folder>
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

INKSCAPE = r"C:\Program Files\Inkscape\bin\inkscape.com"
S = 6  # enlarge by this much before tracing
src, out = sys.argv[1], sys.argv[2]

im = Image.open(src).convert("RGBA")
w, h = im.size
cream = Image.new("RGBA", im.size, (252, 247, 239, 255))
big = Image.alpha_composite(cream, im).convert("RGB").resize((w * S, h * S), Image.LANCZOS)
a = np.asarray(big).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b

letters = lum < 75
# The chopstick is dark too: drop everything below a line between the letters'
# bottoms and the stick's top edge, and the leaf's dark vein in its corner.
xs = np.arange(w * S) / S
line = (181 + (161 - 181) * (xs - 90) / (670 - 90)) * S
letters[np.arange(h * S)[:, None] > line[None, :]] = False
letters[45 * S:95 * S, 645 * S:690 * S] = False
parts = {
    "letters": letters,
    "flower": (r > 200) & (g < 170) & (r - b > 50),
    "leaf": (g > r + 10) & (g > b + 5) & (lum < 200),
}

tmp = tempfile.mkdtemp()


def trace(name, mask):
    png = os.path.join(tmp, name + ".png")
    img = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(S * 0.8))
    img.point(lambda v: 0 if v < 128 else 255).save(png)
    svg_in, svg_out = os.path.join(tmp, "in.svg"), os.path.join(tmp, "out.svg")
    with open(svg_in, "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{w * S}" height="{h * S}"><image id="img" x="0" y="0" width="{w * S}" '
                f'height="{h * S}" xlink:href="{name}.png"/></svg>')
    # Two colour scans, background removed: just the black shape is left.
    subprocess.run([INKSCAPE, "--actions=select-by-id:img;object-trace:2,false,false,true,60,1.0,0.2;"
                    "export-plain-svg;export-filename:out.svg;export-do", "in.svg"],
                   check=True, capture_output=True, cwd=tmp)
    paths = re.findall(r'<path[^>]*?\sd="([^"]+)"', open(svg_out).read())
    assert len(paths) == 1, (name, len(paths))
    return paths[0]


traced = {name: trace(name, mask) for name, mask in parts.items()}

stick = ("M 109.1,188.3 C 279,181.6 496,171.7 653.6,166.5 C 660.6,166.2 663.1,170.2 663.3,175.7 "
         "L 663.8,190.1 C 664,195.7 660.2,198.4 655.1,198.4 L 109.1,198.5 C 103.8,198.5 101.7,196.5 "
         "101.7,193.7 C 101.7,190.8 104.3,188.6 109.1,188.3 Z")
shine = "M 113,192.2 C 276,185.6 491,175.8 652,171"
vein = "M 650,89 C 657,79 664,69 673,60"


def title(letter_colour):
    # The flower's star is a hole: the white circle behind it shows through.
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {18 * S} {690 * S} {188 * S}" role="img" aria-label="Bentotachi">
<title>Bentotachi</title>
<g transform="scale({S})">
  <path d="{stick}" fill="#c8643a"/>
  <path d="{shine}" fill="none" stroke="#e69a76" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
</g>
<path d="{traced["letters"]}" fill="{letter_colour}"/>
<circle cx="{36 * S}" cy="{150 * S}" r="{13 * S}" fill="#ffffff"/>
<path d="{traced["flower"]}" fill="#f2837a" fill-rule="evenodd"/>
<path d="{traced["leaf"]}" fill="#6b9468" fill-rule="evenodd"/>
<path d="{vein}" transform="scale({S})" fill="none" stroke="#4f7a4d" stroke-width="2.2" stroke-linecap="round"/>
</svg>
'''


with open(os.path.join(out, "bentotachi-title.svg"), "w") as f:
    f.write(title("#361f17"))
with open(os.path.join(out, "bentotachi-title-dark.svg"), "w") as f:
    f.write(title("#f1ebe5"))
print("wrote", out)

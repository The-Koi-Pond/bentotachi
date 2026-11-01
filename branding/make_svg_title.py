# Turns the drawn "Bentotachi" title (BentotachiTitle.png) into clean SVGs:
# bentotachi-title.svg (dark letters) and bentotachi-title-dark.svg (cream
# letters, for dark mode).
#
# The letters and leaf are traced with Inkscape (1.4, its own potrace) from
# masks that are enlarged and smoothed first, so the curves come out smooth.
# The umeboshi by the "B" (it took the sakura's place) is traced from its own
# picture, Umeboshi.png. The chopstick and the leaf's baran ridges are drawn
# here, as they're simple shapes. Coordinates are the title PNG's own
# (703 x 228).
#
#   python make_svg_title.py BentotachiTitle.png Umeboshi.png <output folder>
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

INKSCAPE = r"C:\Program Files\Inkscape\bin\inkscape.com"
S = 6  # enlarge by this much before tracing
src, ume_src, out = sys.argv[1], sys.argv[2], sys.argv[3]

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
    "leaf": (g > r + 10) & (g > b + 5) & (lum < 200),
}

# The umeboshi picture has a glow around the plum: the plum's own reds are
# much redder (red minus green over 105) than the glow, so that cuts it out.
u = np.asarray(Image.open(ume_src).convert("RGB")).astype(float)
ur, ug, ub = u[..., 0], u[..., 1], u[..., 2]
plum = ndimage.binary_fill_holes(ndimage.binary_opening((ur - ug > 105) & (ur > 170), iterations=2))
labels, count = ndimage.label(plum)
plum = labels == np.argmax(ndimage.sum(plum, labels, range(1, count + 1))) + 1
ume_shine = plum & (ug > 160)
ume_rows = np.arange(u.shape[0])[:, None]
ume_parts = {
    "plum": plum,
    # The puddle is a pinker red, under the plum (not its edge, not the shine).
    "puddle": ndimage.binary_opening(ndimage.binary_erosion(plum, iterations=4) & (ur >= 226) & (ub > 97)
                                     & (ug > 96) & ~ume_shine & (ume_rows > 650), iterations=3),
    "dark": plum & (ur < 212),  # the lower band and the wrinkles
    "shine": ume_shine,
}

tmp = tempfile.mkdtemp()


def trace(name, mask, blur=S * 0.8):
    png = os.path.join(tmp, name + ".png")
    img = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(blur))
    img.point(lambda v: 0 if v < 128 else 255).save(png)
    mw, mh = img.size
    svg_in, svg_out = os.path.join(tmp, "in.svg"), os.path.join(tmp, "out.svg")
    with open(svg_in, "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{mw}" height="{mh}"><image id="img" x="0" y="0" width="{mw}" '
                f'height="{mh}" xlink:href="{name}.png"/></svg>')
    # Two colour scans, background removed: just the black shape is left.
    subprocess.run([INKSCAPE, "--actions=select-by-id:img;object-trace:2,false,false,true,60,1.0,0.2;"
                    "export-plain-svg;export-filename:out.svg;export-do", "in.svg"],
                   check=True, capture_output=True, cwd=tmp)
    paths = re.findall(r'<path[^>]*?\sd="([^"]+)"', open(svg_out).read())
    assert len(paths) == 1, (name, len(paths))
    return paths[0]


traced = {name: trace(name, mask) for name, mask in parts.items()}
ume = {name: trace("ume-" + name, mask, blur=2) for name, mask in ume_parts.items()}

# Where the umeboshi goes: centred where the sakura was, (36, 150), about 70
# wide. Its paths are in its own picture's pixels.
ys, xs = np.nonzero(plum)
ume_scale = 70 * S / (xs.max() - xs.min())
ume_place = (f"translate({36 * S} {150 * S}) scale({ume_scale:.4f}) "
             f"translate({-(xs.min() + xs.max()) / 2:.1f} {-(ys.min() + ys.max()) / 2:.1f})")

stick = ("M 109.1,188.3 C 279,181.6 496,171.7 653.6,166.5 C 660.6,166.2 663.1,170.2 663.3,175.7 "
         "L 663.8,190.1 C 664,195.7 660.2,198.4 655.1,198.4 L 109.1,198.5 C 103.8,198.5 101.7,196.5 "
         "101.7,193.7 C 101.7,190.8 104.3,188.6 109.1,188.3 Z")
shine = "M 113,192.2 C 276,185.6 491,175.8 652,171"

# The leaf on the "i" has baran's ridges (the green divider in a bento box):
# light and dark lines along its length, clipped to its shape.
LEAF, LEAF_DARK, LEAF_LIGHT = "#5a9a8a", "#3f7668", "#96c6b8"  # jade, the second accent


def ridges(colour, width, opacity, shift):
    # Along the leaf: from (650, 89) to (673, 60); 3.2 apart across it.
    ux, uy = 23 / 37.0, -29 / 37.0
    lines = []
    k = -16 + shift
    while k <= 16:
        x, y = 662 - uy * k, 74 + ux * k
        lines.append(f"M {x - ux * 30:.2f},{y - uy * 30:.2f} L {x + ux * 30:.2f},{y + uy * 30:.2f}")
        k += 3.2
    return f'<path d="{" ".join(lines)}" fill="none" stroke="{colour}" stroke-width="{width}" opacity="{opacity}"/>'


def title(letter_colour):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {18 * S} {690 * S} {188 * S}" role="img" aria-label="Bentotachi">
<title>Bentotachi</title>
<g transform="scale({S})">
  <path d="{stick}" fill="#c8643a"/>
  <path d="{shine}" fill="none" stroke="#e69a76" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
</g>
<path d="{traced["letters"]}" fill="{letter_colour}"/>
<g transform="{ume_place}">
  <path d="{ume["plum"]}" fill="#e15c59"/>
  <path d="{ume["puddle"]}" fill="#e76868"/>
  <path d="{ume["dark"]}" fill="#c8443f" fill-rule="evenodd"/>
  <path d="{ume["shine"]}" fill="#fdc9be"/>
</g>
<path d="{traced["leaf"]}" fill="{LEAF}" fill-rule="evenodd"/>
<clipPath id="leaf-shape"><path d="{traced["leaf"]}" fill-rule="evenodd"/></clipPath>
<g clip-path="url(#leaf-shape)"><g transform="scale({S})">
  {ridges(LEAF_DARK, 1.2, 0.6, 0)}
  {ridges(LEAF_LIGHT, 0.9, 0.55, 1.6)}
</g></g>
</svg>
'''


with open(os.path.join(out, "bentotachi-title.svg"), "w") as f:
    f.write(title("#361f17"))
with open(os.path.join(out, "bentotachi-title-dark.svg"), "w") as f:
    f.write(title("#f1ebe5"))
print("wrote", out)

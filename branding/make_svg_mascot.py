# Turns the onigiri mascot (Onigiri.png: the skewered, screaming one) into a
# clean SVG with a see-through background: onigiri.svg.
#
# The outline and nori, the chopsticks, the shading and the highlight are
# traced with Inkscape 1.4's tracer from enlarged, smoothed masks. The eyes and
# blush are drawn as circles and ellipses where they are in the picture, so
# moods can change them easily. The body's cream is the same colour as the
# picture's background, so it's found as "inside the outline" instead.
#
#   python make_svg_mascot.py Onigiri.png <output folder>
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

INKSCAPE = r"C:\Program Files\Inkscape\bin\inkscape.com"
S = 3  # enlarge by this much before tracing
src, out = sys.argv[1], sys.argv[2]

im = Image.open(src).convert("RGB")
w, h = im.size
a = np.asarray(im.resize((w * S, h * S), Image.LANCZOS)).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b

dark = lum < 90  # the outline and the nori
body = ndimage.binary_fill_holes(dark)  # the outline and everything inside it
inside = ndimage.binary_erosion(body, iterations=4 * S) & ~dark
orange = (r > 170) & (g > 70) & (g < 150) & (b < 110)
sticks = orange & ~body
# Shapes that meet the outline go a little under it instead of sharing its
# edge: two smoothed edges in the same place leave a pale rim (seen on the
# dark website) and gaps where the chopsticks meet the onigiri.
parts = {
    "chopsticks": sticks | (ndimage.binary_dilation(sticks, iterations=6 * S) & body),
    "body": ndimage.binary_erosion(body, iterations=5 * S),
    "shade": inside & (r > 235) & (g > 225) & (g < 243) & (b < 228) & (b > 205),
    "highlight": inside & (g > 252) & (b > 252),
    "dark": dark,
}
eyes = inside & orange
blush = inside & (r > 235) & (g > 205) & (g < 228) & (b > 190) & (b < 214)

tmp = tempfile.mkdtemp()


def trace(name, mask):
    img = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(S * 0.8))
    img.point(lambda v: 0 if v < 128 else 255).save(os.path.join(tmp, name + ".png"))
    with open(os.path.join(tmp, "in.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{w * S}" height="{h * S}"><image id="img" x="0" y="0" width="{w * S}" '
                f'height="{h * S}" xlink:href="{name}.png"/></svg>')
    # Two colour scans, background removed: just the black shape is left.
    subprocess.run([INKSCAPE, "--actions=select-by-id:img;object-trace:2,false,false,true,60,1.0,0.2;"
                    "export-plain-svg;export-filename:out.svg;export-do", "in.svg"],
                   check=True, capture_output=True, cwd=tmp)
    paths = re.findall(r'<path[^>]*?\sd="([^"]+)"', open(os.path.join(tmp, "out.svg")).read())
    assert len(paths) == 1, (name, len(paths))
    return paths[0]


def blobs(mask, count):
    """The `count` biggest spots in a mask, as (x, y, half-width, half-height), left to right."""
    labels, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, labels, range(1, n + 1))
    found = []
    for label in np.argsort(sizes)[::-1][:count] + 1:
        ys, xs = np.nonzero(labels == label)
        found.append((xs.mean(), ys.mean(), (xs.max() - xs.min() + 1) / 2, (ys.max() - ys.min() + 1) / 2))
    assert len(found) == count, (count, len(found))
    return sorted(found)


traced = {name: trace(name, mask) for name, mask in parts.items()}
eye_spots = blobs(eyes, 2)
# The shading's edge is blush-coloured too: look only just under the eyes.
eye_y = int(eye_spots[0][1])
near_eyes = np.zeros_like(blush)
near_eyes[eye_y:eye_y + 90 * S] = True
blush_spots = blobs(blush & near_eyes, 2)

ys, xs = np.nonzero(body | parts["chopsticks"])
pad = 12 * S
x0, y0, x1, y1 = xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad
eye_shapes = "\n".join(f'  <circle cx="{x:.0f}" cy="{y:.0f}" r="{(rx + ry) / 2:.0f}"/>' for x, y, rx, ry in eye_spots)
blush_shapes = "\n".join(f'  <ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rx:.0f}" ry="{ry:.0f}"/>' for x, y, rx, ry in blush_spots)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1 - x0} {y1 - y0}" role="img" aria-label="Bentotachi's onigiri">
<title>Bentotachi's onigiri</title>
<path id="chopsticks" d="{traced["chopsticks"]}" fill="#a87a43"/>
<path id="body" d="{traced["body"]}" fill="#fef7ed"/>
<path id="shade" d="{traced["shade"]}" fill="#feeddb"/>
<path id="highlight" d="{traced["highlight"]}" fill="#ffffff"/>
<g id="blush" fill="#fddccb">
{blush_shapes}
</g>
<g id="eyes" fill="#d66750">
{eye_shapes}
</g>
<path id="outline-and-nori" d="{traced["dark"]}" fill="#2e201b" fill-rule="evenodd"/>
</svg>
'''
with open(os.path.join(out, "onigiri.svg"), "w") as f:
    f.write(svg)
print("eyes", [tuple(round(v) for v in e) for e in eye_spots], "blush", [tuple(round(v) for v in e) for e in blush_spots])
print("sizes", {k: len(v) for k, v in traced.items()})

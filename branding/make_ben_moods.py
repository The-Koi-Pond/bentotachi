# Ben's moods: the onigiri (onigiri.svg) with different eyes and one or two
# extras each, for empty and error screens. Built from Ben's own parts, so
# every mood has his exact outline, colours and wooden chopsticks.
#
#   python make_ben_moods.py <folder with onigiri.svg> <output folder>
#
# Writes ben-<mood>.svg:
#   sweat   worried slanted eyes and brows, an outlined sweat drop (an empty pantry)
#   scream  squeezed >< eyes, a strong blush, a grain of rice flying off (an import that failed)
#   bitten  a bite out of his head (deleting everything)
#   ready   holding his chopsticks, waiting (no recipes yet)
#   halo    happy closed eyes, a halo and a sparkle (a backup saved)
#
# Coordinates are onigiri.svg's own: his body spans about x 582-3147,
# y 702-3090, the outline is about 111 thick, the eyes are at y 1708.
# Needs Python with Pillow, numpy and scipy, and Inkscape 1.4 (the bite is
# drawn as pixels and traced back into curves, so its edge is smooth).
import os
import re
import subprocess
import sys
import tempfile
import xml.dom.minidom

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

INKSCAPE = r"C:\Program Files\Inkscape\bin\inkscape.com"
src, out = sys.argv[1], sys.argv[2]
ben = open(os.path.join(src, "onigiri.svg")).read()
vx, vy, vw, vh = [float(v) for v in re.search(r'viewBox="([^"]+)"', ben).group(1).split()]
tmp = tempfile.mkdtemp()


def part(name):
    """One of Ben's layers: a <path .../> or a whole <g>...</g>."""
    found = re.search(rf'<path id="{name}"[^>]*/>\n', ben) or re.search(rf'<g id="{name}"[\s\S]*?</g>\n', ben)
    return found.group(0)


# WOOD is his chopsticks: plain waribashi wood since 2026-11-04 (orange before).
INK, RICE, WOOD, EYE = "#2e201b", "#fef7ed", "#a87a43", "#d66750"
GOLD = "#e0a100"
DROP, DROP_EDGE, DROP_SHINE = "#a9dccf", "#3f7668", "#ffffff"  # jade
BLUSH, BLUSH_LINE = "#f4a3a0", "#e47b78"


def line(colour=INK, width=52):
    """A rounded line's attributes (each only once: browsers reject an SVG
    picture with a doubled attribute)."""
    return f'fill="none" stroke="{colour}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"'


def svg(inner, box=(vx, vy, vw, vh), label="Bentotachi's onigiri"):
    x, y, w, h = box
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.0f} {y:.0f} {w:.0f} {h:.0f}" role="img" '
            f'aria-label="{label}">\n<title>{label}</title>\n{inner}</svg>\n')


def onigiri(eyes=None, blush=None, chopsticks=True):
    """Ben's layers in order, with his eyes or blush swapped if given."""
    layers = [part("chopsticks") if chopsticks else "", part("body"), part("shade"), part("highlight"),
              blush if blush is not None else part("blush"), eyes if eyes is not None else part("eyes"),
              part("outline-and-nori")]
    return "".join(layers)


def disk(radius):
    y, x = np.ogrid[-radius:radius + 1, -radius:radius + 1]
    return x * x + y * y <= radius * radius


def trace(name, mask):
    """A black-and-white mask traced into one smooth path (Inkscape's tracer),
    in the mask's pixels."""
    img = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
    img.point(lambda v: 0 if v < 128 else 255).save(os.path.join(tmp, name + ".png"))
    w, h = img.size
    with open(os.path.join(tmp, "in.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" '
                f'height="{h}"><image id="img" x="0" y="0" width="{w}" height="{h}" xlink:href="{name}.png"/></svg>')
    subprocess.run([INKSCAPE, "--actions=select-by-id:img;object-trace:2,false,false,true,60,1.0,0.2;"
                    "export-plain-svg;export-filename:out.svg;export-do", "in.svg"],
                   check=True, capture_output=True, cwd=tmp)
    paths = re.findall(r'<path[^>]*?\sd="([^"]+)"', open(os.path.join(tmp, "out.svg")).read())
    assert len(paths) == 1, (name, len(paths))
    return paths[0]


moods = {}

# Worried: slanted eyes and curved brows in his eye colour, both rising to
# the middle, and an outlined jade sweat drop.
worried_eyes = (f'<g fill="{EYE}"><ellipse cx="1447" cy="1712" rx="70" ry="42" transform="rotate(-22 1447 1712)"/>'
                f'<ellipse cx="2268" cy="1712" rx="70" ry="42" transform="rotate(22 2268 1712)"/></g>\n')
brows = f'<path d="M 1345,1600 Q 1420,1548 1530,1532 M 2370,1600 Q 2295,1548 2185,1532" {line(EYE, 46)}/>\n'
drop = (f'<path d="M 1040,1160 C 1105,1275 1170,1345 1170,1430 C 1170,1508 1110,1560 1040,1560 '
        f'C 970,1560 910,1508 910,1430 C 910,1345 975,1275 1040,1160 Z" fill="{DROP}" stroke="{DROP_EDGE}" '
        f'stroke-width="36" stroke-linejoin="round"/>\n'
        f'<ellipse cx="992" cy="1450" rx="26" ry="50" fill="{DROP_SHINE}" opacity="0.85"/>\n')
moods["sweat"] = svg(onigiri(worried_eyes) + brows + drop, label="Ben, sweating")


# Screaming harder: big squeezed >< eyes in his eye colour, a strong blush
# with two little shine marks, and a grain of rice flying off.
def strong_blush(cx, cy):
    return (f'<ellipse cx="{cx}" cy="{cy}" rx="112" ry="76" fill="{BLUSH}"/>'
            f'<path d="M {cx - 24},{cy - 26} L {cx - 32},{cy + 20} M {cx + 18},{cy - 26} L {cx + 10},{cy + 20}" '
            f'{line(BLUSH_LINE, 20)}/>')


scream_blush = f'<g>{strong_blush(1285, 1885)}{strong_blush(2430, 1885)}</g>\n'
scream_eyes = f'<path d="M 1350,1605 L 1545,1712 L 1350,1819 M 2365,1605 L 2170,1712 L 2365,1819" {line(EYE, 66)}/>\n'
# The motion lines are a mid brown, so they show on light and dark pages.
grain = (f'<ellipse cx="3150" cy="820" rx="85" ry="52" transform="rotate(-28 3150 820)" fill="{RICE}" '
         f'stroke="{INK}" stroke-width="34"/>\n'
         f'<path d="M 2905,905 L 2985,870 M 2945,995 L 3025,955" {line("#9a8b80", 34)}/>\n')
moods["scream"] = svg(onigiri(scream_eyes, scream_blush) + grain, box=(vx, 700, vw + 30, vh + vy - 700),
                      label="Ben, screaming")

# Bitten: three tooth marks along his top-right edge. His shape is drawn as
# pixels, the bites cut out and their corners rounded, then traced back. One
# new outline runs all the way round the bitten shape, on top: a patch along
# the bite alone left a step where it met his own outline. Under it, he is
# clipped to a shape a little inside that outline, so no cream shares its
# outer edge (a shared edge shows as a pale hairline on dark pages). The
# chopsticks stay whole (they're behind him, and show through the bite).
K = 0.5  # pixels per unit
silhouette_svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx} {vy} {vw} {vh}" width="{vw * K:.0f}" '
                  f'height="{vh * K:.0f}">{part("body")}{part("outline-and-nori")}</svg>')
with open(os.path.join(tmp, "ben.svg"), "w") as f:
    f.write(silhouette_svg)
subprocess.run([INKSCAPE, "ben.svg", "--export-type=png", f"--export-width={vw * K:.0f}",
                "--export-filename=ben.png"], check=True, capture_output=True, cwd=tmp)
shape = np.asarray(Image.open(os.path.join(tmp, "ben.png")).convert("RGBA"))[..., 3] > 127
# Centres just inside his outer edge (it runs from about (2337, 900) to
# (2604, 1200)), deep enough that each reads as a tooth mark.
BITES = [(2262, 860, 180), (2428, 1047, 200), (2595, 1234, 180)]
rows, cols = np.ogrid[:shape.shape[0], :shape.shape[1]]
bites = np.zeros_like(shape)
for x, y, r in BITES:
    bites |= (cols - (x - vx) * K) ** 2 + (rows - (y - vy) * K) ** 2 <= (r * K) ** 2
bitten_shape = ndimage.binary_opening(shape & ~bites, structure=disk(round(14 * K * 2)))
# His outline measures 95-102 units around the top and the bite (measured
# from onigiri.svg), so the new one is 98: where his own is thicker (the
# bottom), his shows through; elsewhere the two match.
outline_px = round(98 * K)
rim = bitten_shape & ~ndimage.binary_erosion(bitten_shape, structure=disk(outline_px))
inside = ndimage.binary_erosion(bitten_shape, structure=disk(outline_px // 2))
to_units = f"translate({vx} {vy}) scale({1 / K})"
bitten = (f'<defs><clipPath id="bitten-shape"><path d="{trace("inside", inside)}" transform="{to_units}"/>'
          f'</clipPath></defs>\n'
          + part("chopsticks")
          + '<g clip-path="url(#bitten-shape)">\n' + onigiri(chopsticks=False) + '</g>\n'
          + f'<path d="{trace("rim", rim)}" transform="{to_units}" fill="{INK}"/>\n')
moods["bitten"] = svg(bitten, label="Ben, with a bite out of him")

# Ready: holding his chopsticks in front of him, with little hands.
ready = (onigiri(chopsticks=False)
         + f'<path d="M 1150,2330 L 2620,2170 M 1175,2445 L 2645,2285" {line(WOOD, 78)}/>\n'
         + f'<g fill="{RICE}" stroke="{INK}" stroke-width="44"><circle cx="1290" cy="2380" r="118"/>'
           f'<circle cx="2480" cy="2235" r="118"/></g>\n')
moods["ready"] = svg(ready, label="Ben, holding his chopsticks")

# Relieved: soft closed eyes in his eye colour, a gold halo and one sparkle.
happy_eyes = f'<path d="M 1355,1738 Q 1447,1655 1539,1738 M 2176,1738 Q 2268,1655 2360,1738" {line(EYE, 58)}/>\n'
halo = f'<ellipse cx="1864" cy="505" rx="400" ry="95" fill="none" stroke="{GOLD}" stroke-width="58"/>\n'
sparkle = (f'<path d="M 3020,620 Q 3045,760 3165,785 Q 3045,810 3020,950 Q 2995,810 2875,785 Q 2995,760 3020,620 Z" '
           f'fill="{GOLD}"/>\n')
moods["halo"] = svg(onigiri(happy_eyes) + halo + sparkle, box=(vx, 360, vw, vh + vy - 360), label="Ben, relieved")

for name, content in moods.items():
    path = os.path.join(out, f"ben-{name}.svg")
    with open(path, "w") as f:
        f.write(content)
    xml.dom.minidom.parse(path)  # must be valid XML, or browsers show nothing
print("wrote", ", ".join(moods))

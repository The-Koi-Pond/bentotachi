# Ben's moods: the onigiri (onigiri.svg) with different eyes and one or two
# extras each, for empty and error screens. Built from Ben's own parts, so
# every mood has his exact outline, colours and orange chopsticks.
#
#   python make_ben_moods.py <folder with onigiri.svg> <output folder>
#
# Writes ben-<mood>.svg:
#   sweat   worried brows and a sweat drop (an empty pantry)
#   scream  >< eyes and a grain of rice flying off (an import that failed)
#   bitten  a bite out of his head (deleting everything)
#   ready   holding his chopsticks, waiting (no recipes yet)
#   halo    happy closed eyes, a halo and a sparkle (a backup saved)
#
# Coordinates are onigiri.svg's own: his body spans about x 582-3147,
# y 702-3090, the outline is about 111 thick, the eyes are at y 1708.
import os
import re
import sys

src, out = sys.argv[1], sys.argv[2]
ben = open(os.path.join(src, "onigiri.svg")).read()
_, vy, vw, vh = [float(v) for v in re.search(r'viewBox="([^"]+)"', ben).group(1).split()]
vx = float(re.search(r'viewBox="([^ ]+)', ben).group(1))


def part(name):
    """One of Ben's layers: a <path .../> or a whole <g>...</g>."""
    found = re.search(rf'<path id="{name}"[^>]*/>\n', ben) or re.search(rf'<g id="{name}"[\s\S]*?</g>\n', ben)
    return found.group(0)


INK, RICE, ORANGE = "#2e201b", "#fef7ed", "#c8643a"
GOLD, JADE_LIGHT, JADE_SHINE = "#e0a100", "#7fbfae", "#d6efe8"
def line(width=52):
    """A rounded ink line's attributes (each only once: browsers reject an
    SVG picture with a doubled attribute)."""
    return f'fill="none" stroke="{INK}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"'


LINE = line()
EYE_L, EYE_R, EYE_Y = 1447, 2268, 1708

# The bite: three overlapping circles over his top-right edge.
BITES = [(2425, 905, 150), (2550, 1040, 165), (2672, 1185, 150)]
BODY_D = re.search(r'id="body" d="([^"]+)"', ben).group(1)


def svg(inner, box=(vx, vy, vw, vh), label="Bentotachi's onigiri"):
    x, y, w, h = box
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.0f} {y:.0f} {w:.0f} {h:.0f}" role="img" '
            f'aria-label="{label}">\n<title>{label}</title>\n{inner}</svg>\n')


def onigiri(eyes=None, chopsticks=True):
    """Ben's layers in order, with his eyes swapped for `eyes` if given."""
    layers = [part("chopsticks") if chopsticks else "", part("body"), part("shade"), part("highlight"),
              part("blush"), eyes if eyes is not None else part("eyes"), part("outline-and-nori")]
    return "".join(layers)


moods = {}

# Worried: his dots, brows rising to the middle, and a jade sweat drop.
brows = f'<path d="M 1372,1600 L 1512,1556 M 2203,1556 L 2343,1600" {line(44)}/>\n'
drop = (f'<path d="M 1040,1160 C 1105,1275 1170,1345 1170,1430 C 1170,1508 1110,1560 1040,1560 '
        f'C 970,1560 910,1508 910,1430 C 910,1345 975,1275 1040,1160 Z" fill="{JADE_LIGHT}"/>\n'
        f'<ellipse cx="995" cy="1450" rx="30" ry="52" fill="{JADE_SHINE}"/>\n')
moods["sweat"] = svg(onigiri() + brows + drop, label="Ben, sweating")

# Screaming harder: >< eyes, and a grain of rice flying off with two lines.
scream_eyes = (f'<path d="M 1385,1630 L 1515,1708 L 1385,1786 M 2330,1630 L 2200,1708 L 2330,1786" {LINE}/>\n')
# The motion lines are a mid brown, so they show on light and dark pages.
grain = (f'<ellipse cx="3150" cy="820" rx="85" ry="52" transform="rotate(-28 3150 820)" fill="{RICE}" '
         f'stroke="{INK}" stroke-width="34"/>\n'
         f'<path d="M 2905,905 L 2985,870 M 2945,995 L 3025,955" fill="none" stroke="#9a8b80" '
         f'stroke-width="34" stroke-linecap="round"/>\n')
moods["scream"] = svg(onigiri(scream_eyes) + grain, box=(vx, 700, vw + 30, vh + vy - 700), label="Ben, screaming")

# Bitten: the bite cuts everything but the chopsticks (they show through
# it, behind him), with a dark rim along the bite like his outline.
holes = "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in BITES)
rims = "".join(f'<circle cx="{x}" cy="{y}" r="{r + 111}"/>' for x, y, r in BITES)
bitten = (f'<defs><mask id="bite" maskUnits="userSpaceOnUse" x="{vx}" y="{vy}" width="{vw}" height="{vh}">'
          f'<rect x="{vx}" y="{vy}" width="{vw}" height="{vh}" fill="#fff"/><g fill="#000">{holes}</g></mask>'
          f'<clipPath id="ben-body"><path d="{BODY_D}"/></clipPath></defs>\n'
          + part("chopsticks")
          + '<g mask="url(#bite)">\n' + onigiri(chopsticks=False)
          + f'<g clip-path="url(#ben-body)" fill="{INK}">{rims}</g>\n</g>\n')
moods["bitten"] = svg(bitten, label="Ben, with a bite out of him")

# Ready: holding his chopsticks in front of him, with little hands.
ready = (onigiri(chopsticks=False)
         + f'<path d="M 1150,2330 L 2620,2170 M 1175,2445 L 2645,2285" fill="none" stroke="{ORANGE}" '
           f'stroke-width="78" stroke-linecap="round"/>\n'
         + f'<g fill="{RICE}" stroke="{INK}" stroke-width="44"><circle cx="1290" cy="2380" r="118"/>'
           f'<circle cx="2480" cy="2235" r="118"/></g>\n')
moods["ready"] = svg(ready, label="Ben, holding his chopsticks")

# Relieved: closed happy eyes, a gold halo and one sparkle.
happy_eyes = f'<path d="M 1365,1735 Q 1447,1625 1529,1735 M 2186,1735 Q 2268,1625 2350,1735" {LINE}/>\n'
halo = f'<ellipse cx="1864" cy="505" rx="400" ry="95" fill="none" stroke="{GOLD}" stroke-width="58"/>\n'
sparkle = (f'<path d="M 3020,620 Q 3045,760 3165,785 Q 3045,810 3020,950 Q 2995,810 2875,785 Q 2995,760 3020,620 Z" '
           f'fill="{GOLD}"/>\n')
moods["halo"] = svg(onigiri(happy_eyes) + halo + sparkle, box=(vx, 360, vw, vh + vy - 360), label="Ben, relieved")

for name, content in moods.items():
    with open(os.path.join(out, f"ben-{name}.svg"), "w") as f:
        f.write(content)
print("wrote", ", ".join(moods))

# Each file must be valid XML, or browsers show nothing.
import xml.dom.minidom  # noqa: E402

for name in moods:
    xml.dom.minidom.parse(os.path.join(out, f"ben-{name}.svg"))

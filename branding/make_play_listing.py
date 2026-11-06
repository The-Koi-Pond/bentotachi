# Makes the pictures for Bentotachi's Google Play store listing, into
# branding/play/ (docs/PLAY-LISTING.md says what goes where):
#
# - icon-512.png: the app icon, 512x512, Ben on the launcher icon's peach.
#   A full square: Google rounds the corners and adds the shadow itself.
# - feature-graphic.png: the 1024x500 banner at the top of the listing.
# - screenshot-N-<name>.jpg: 1080x1920 phone screenshots, each a capture of
#   the app with a short caption above it.
#
#   python branding/make_play_listing.py <folder with the raw captures>
#
# Run it from the repository folder. The raw captures are PNGs of the app at
# 412x732 and 3x pixel density (1236x2196), named raw-<name>.png, taken with a
# made-up household on a throwaway server (never real data: the screenshots
# are public). Needs Pillow, Inkscape 1.4 at the path below, Segoe UI
# (Windows), and Pond Pebbles from The Koi Pond's website repository (the
# captions, like the app's page titles).
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

INKSCAPE = r"C:\Program Files\Inkscape\bin\inkscape.com"
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "web" / "src" / "assets"
OUT = ROOT / "branding" / "play"
ITALIC = r"C:\Windows\Fonts\segoeuii.ttf"
# The studio's font (the .otf: Pillow can't read the app's .woff2 copy).
POND_PEBBLES = Path(r"C:\Projects\TheKoiPond\the-koi-pond.github.io\font\PondPebbles.otf")

# Bentotachi's colours (docs/VISION.md).
ICON_BG = "#f6e4da"  # the launcher icon's peach (values/ic_launcher_background.xml)
TEXT, TEXT_DARK = "#2b2420", "#f1ebe5"
SOFT_JADE, SOFT_PLUM, NIGHT = "#e2efeb", "#f4e4e7", "#141b1b"
PLUM = "#a82d4a"

# The screenshots, in the order Google shows them (the first three matter
# most), with their captions and backgrounds.
SHOTS = [
    ("recipes", "Every recipe in one place, sorted onto shelves", SOFT_JADE),
    ("shakshuka", "Save recipes from any website, minus the life story", SOFT_PLUM),
    ("plan", "Plan the week, and settle “didn’t we just have that?”", SOFT_JADE),
    ("shopping", "One shopping list for the whole household, by aisle", SOFT_PLUM),
    ("pantry", "Check the cupboard before buying a fourth jar of cumin", SOFT_JADE),
    ("ingredients", "Cooking for six? No maths needed.", SOFT_PLUM),
    ("fridge", "Notes on the fridge door, for everyone at home", SOFT_JADE),
    ("plan-dark", "Light or dark, whichever your phone likes", NIGHT),
]


def render(svg, width, drop=()):
    """The SVG at the given width, see-through around it, cropped to its art.
    Lines containing any of the `drop` strings are left out first."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "art.png"
        if drop:
            lines = Path(svg).read_text(encoding="utf-8").splitlines(keepends=True)
            svg = Path(tmp) / "art.svg"
            svg.write_text("".join(l for l in lines if not any(d in l for d in drop)), encoding="utf-8")
        subprocess.run([INKSCAPE, str(svg), "--export-type=png", f"--export-filename={out}",
                        f"--export-width={width}", "--export-background-opacity=0"],
                       check=True, capture_output=True)
        image = Image.open(out).convert("RGBA")
        return image.crop(image.getbbox())


def fit(image, width=None, height=None):
    scale = width / image.width if width else height / image.height
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)


def wrapped(draw, text, font, width):
    """The caption's lines, broken between words to fit the width. Two
    lines are evened out (Xel, 2026-11-06): broken where the longer of the
    two is shortest, rather than filling the first and leaving a word or
    two on the second."""
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    if len(lines) == 2:
        words = text.split()

        # A break at a sentence's end always wins when both lines fit
        # ("Cooking for six? / The maths…"); one after a comma wins when it's
        # nearly as even.
        def score(i):
            longest = max(draw.textlength(" ".join(words[:i]), font=font),
                          draw.textlength(" ".join(words[i:]), font=font))
            if longest > width:
                return float("inf")
            end = words[i - 1][-1]
            return longest * (0.01 if end in "?!." else 0.95 if end == "," else 1)

        best = min(range(1, len(words)), key=score)
        lines = [" ".join(words[:best]), " ".join(words[best:])]
    return lines


OUT.mkdir(parents=True, exist_ok=True)

# The icon: Ben inside a circle 86% of the square, so Google's rounded
# corners never clip his chopsticks.
ben = render(ASSETS / "onigiri.svg", 2048)
icon = Image.new("RGBA", (512, 512), ICON_BG)
alpha = ben.getchannel("A").point(lambda v: 255 if v > 24 else 0)
cx, cy = ben.width / 2, ben.height / 2
far = max(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
          for y in range(0, ben.height, 4) for x in range(0, ben.width, 4) if alpha.getpixel((x, y)))
small = fit(ben, width=round(512 * 0.86 / 2 * ben.width / far))
icon.alpha_composite(small, ((512 - small.width) // 2, (512 - small.height) // 2))
icon.save(OUT / "icon-512.png", optimize=True)

# The feature graphic: screaming Ben beside the title and the tagline, kept
# well inside the edges (Google crops them in some places), on soft jade.
graphic = Image.new("RGBA", (1024, 500), SOFT_JADE)
# Screaming Ben without his flying grain of rice and its motion lines
# (make_ben_moods.py draws them), which read as clutter at this size.
scream = fit(render(ASSETS / "ben-scream.svg", 1600, drop=('cx="3150"', "M 2905,905")), height=250)
title = fit(render(ASSETS / "bentotachi-title.svg", 2400), width=500)
draw = ImageDraw.Draw(graphic)
font = ImageFont.truetype(ITALIC, 30)
tagline = "Because dinner insists on happening every day."
# Two even lines, rather than one long one and an orphan.
words = tagline.split()
split = min(range(1, len(words)), key=lambda i: max(draw.textlength(" ".join(words[:i]), font=font),
                                                    draw.textlength(" ".join(words[i:]), font=font)))
tag_lines = [" ".join(words[:split]), " ".join(words[split:])]
gap = 48
block_w = scream.width + gap + title.width
x = (1024 - block_w) // 2
graphic.alpha_composite(scream, (x, (500 - scream.height) // 2))
text_h = title.height + 24 + len(tag_lines) * 40
ty = (500 - text_h) // 2
title_x = x + scream.width + gap
graphic.alpha_composite(title, (title_x, ty))
# The tagline centred under the title.
for i, line in enumerate(tag_lines):
    w = draw.textlength(line, font=font)
    draw.text((title_x + (title.width - w) / 2, ty + title.height + 24 + i * 40), line, font=font, fill=TEXT)
graphic.convert("RGB").save(OUT / "feature-graphic.png", optimize=True)

# The screenshots: caption on top, the capture below with rounded corners and
# a soft shadow.
raw = Path(sys.argv[1]) if len(sys.argv) > 1 else None
for old in OUT.glob("screenshot-*.jpg"):
    old.unlink()
for n, (name, caption, bg) in enumerate(SHOTS, start=1):
    if not raw:
        break
    shot = Image.open(raw / f"raw-{name}.png").convert("RGB")
    canvas = Image.new("RGB", (1080, 1920), bg)
    draw = ImageDraw.Draw(canvas)
    # Captions in Pond Pebbles (Xel, 2026-11-06), like the app's page titles.
    font = ImageFont.truetype(str(POND_PEBBLES), 76)
    lines = wrapped(draw, caption, font, 940)
    line_h = 92
    top = (250 - len(lines) * line_h) // 2 + 10
    for i, line in enumerate(lines):
        w = draw.textlength(line, font=font)
        draw.text(((1080 - w) / 2, top + i * line_h), line, font=font, fill=TEXT_DARK if bg == NIGHT else TEXT)

    phone = fit(shot, width=880)
    radius = 44
    mask = Image.new("L", (phone.width * 2, phone.height * 2), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, mask.width - 1, mask.height - 1), radius=radius * 2, fill=255)
    mask = mask.resize(phone.size, Image.LANCZOS)
    px, py = (1080 - phone.width) // 2, 280
    shadow = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(shadow).rounded_rectangle((px, py + 10, px + phone.width, py + phone.height + 10), radius=radius, fill=70)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.paste(Image.new("RGB", canvas.size, "#000000"), (0, 0), shadow)
    canvas.paste(phone, (px, py), mask)
    canvas.save(OUT / f"screenshot-{n}-{name}.jpg", quality=92)

print(f"wrote {OUT}")

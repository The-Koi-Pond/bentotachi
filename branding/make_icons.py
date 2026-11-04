# Makes Bento's Android icons, launch screens and web icons from the onigiri
# logo (a PNG with a see-through background).
# Usage: python make_icons.py <BentoLogo.png> <android res folder> <web public folder> <preview folder>
import glob
import os
import sys
from PIL import Image, ImageDraw

logo_path, res, public, preview = sys.argv[1:5]
logo = Image.open(logo_path).convert("RGBA")
logo = logo.crop(logo.getbbox())

ICON_BG = (0xF6, 0xE4, 0xDA, 255)  # peach, the soft accent before the 2026-11-04 colours
SPLASH_BG = (0xF3, 0xF6, 0xF4, 255)  # --bg (tea-rice)

# Android density buckets: launcher icon size (48dp) and adaptive foreground (108dp).
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def placed(canvas_size, share, background=(0, 0, 0, 0)):
    """The logo centred on a square canvas, its longest side `share` of it."""
    canvas = Image.new("RGBA", (canvas_size, canvas_size), background)
    scale = canvas_size * share / max(logo.size)
    size = (round(logo.width * scale), round(logo.height * scale))
    art = logo.resize(size, Image.LANCZOS)
    canvas.alpha_composite(art, ((canvas_size - size[0]) // 2, (canvas_size - size[1]) // 2))
    return canvas


def fitted(canvas_size, radius_share, background=(0, 0, 0, 0)):
    """Like placed(), but sized so every visible bit of the logo is within a
    circle `radius_share` of the canvas wide (the chopstick ends reach the
    corners, where a round launcher would cut them off)."""
    alpha = logo.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    cx, cy = logo.width / 2, logo.height / 2
    far = max(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
              for x, y in ((x, y) for y in range(0, logo.height, 2) for x in range(0, logo.width, 2))
              if alpha.getpixel((x, y)))
    return placed(canvas_size, radius_share * max(logo.size) / (2 * far), background)


def masked(image, shape):
    """Cuts an icon to a circle or a rounded square, smoothly (drawn 4x, shrunk)."""
    big = image.size[0] * 4
    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)
    if shape == "circle":
        draw.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:
        draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=big // 6, fill=255)
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    out.paste(image, (0, 0), mask.resize(image.size, Image.LANCZOS))
    return out


for name, factor in DENSITIES.items():
    folder = os.path.join(res, f"mipmap-{name}")
    # Adaptive icon foreground: 108dp, with everything inside the middle
    # 66dp circle every launcher shape keeps (a little inside it, to breathe).
    fitted(round(108 * factor), 0.58).save(os.path.join(folder, "ic_launcher_foreground.png"), optimize=True)
    # Older Android: a finished square and round icon.
    size = round(48 * factor)
    full = placed(size, 0.78, ICON_BG)
    masked(full, "square").save(os.path.join(folder, "ic_launcher.png"), optimize=True)
    masked(fitted(size, 0.88, ICON_BG), "circle").save(os.path.join(folder, "ic_launcher_round.png"), optimize=True)

# Launch screens: keep each existing file's size, onigiri in the middle.
for path in glob.glob(os.path.join(res, "drawable*", "splash.png")):
    width, height = Image.open(path).size
    splash = Image.new("RGBA", (width, height), SPLASH_BG)
    side = round(min(width, height) * 0.32)
    art = placed(side, 1.0)
    splash.alpha_composite(art, ((width - side) // 2, (height - side) // 2))
    splash.convert("RGB").save(path, optimize=True)

# Web: the browser tab icon and the "add to home screen" icon.
os.makedirs(public, exist_ok=True)
placed(64, 0.94).save(os.path.join(public, "favicon.png"), optimize=True)
placed(180, 0.78, ICON_BG).convert("RGB").save(os.path.join(public, "apple-touch-icon.png"), optimize=True)

# Previews of the adaptive icon as launchers show it: circle, squircle, square.
fg = fitted(432, 0.58)
tile = Image.new("RGBA", (432, 432), ICON_BG)
tile.alpha_composite(fg)
row = Image.new("RGBA", (3 * 300 + 40, 340), (40, 40, 40, 255))
for i, shape in enumerate(["circle", "square", "none"]):
    # Launchers show the middle 72dp of the 108dp canvas.
    shown = tile.crop((72, 72, 360, 360)).resize((288, 288), Image.LANCZOS)
    shown = masked(shown, shape) if shape != "none" else shown
    row.alpha_composite(shown, (20 + i * 300, 26))
row.save(os.path.join(preview, "icon-preview.png"))
print("done")

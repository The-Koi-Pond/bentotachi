# Cuts the Bento title out of its cream background, and makes a dark-mode
# copy with cream letters and a lighter chopstick.
# Usage: python make_title.py <BentoTitle.png> <out_dir>
#
# Clearly coloured pixels stay fully solid with their real colours. Only the
# soft edge (a pixel or two) is blended, by working out how much of the
# nearest solid colour it holds. Faint noise in the background becomes clear.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out_dir = sys.argv[1], sys.argv[2]
rgb = np.asarray(Image.open(src).convert("RGB")).astype(float)
bg = rgb[0, 0].copy()  # the flat cream background
distance = np.abs(rgb - bg).max(axis=2)

solid = distance > 60

# Light patches enclosed by the pink flower (its star centre) are solid too;
# enclosed patches inside letters (the holes in B, e, o) are background.
labels, count = ndimage.label(~solid)
border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
for i in range(1, count + 1):
    if i in border:
        continue
    patch = labels == i
    ring = ndimage.binary_dilation(patch, iterations=2) & ~patch
    r, g = rgb[ring][:, 0].mean(), rgb[ring][:, 1].mean()
    if r - g > 50:  # pink around it: part of the flower
        solid |= patch

# Soft edges: how much of the nearest solid colour each pixel holds.
gap, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
nearest = rgb[iy, ix]
towards = nearest - bg
amount = ((rgb - bg) * towards).sum(2) / np.maximum((towards**2).sum(2), 1)
alpha = np.where(solid, 1.0, np.clip(amount, 0, 1))
alpha[(gap > 2.5) | (distance < 12)] = 0
alpha[solid] = 1
colour = np.where(solid[..., None], rgb, nearest)

# Which pixels are the brown letters, and which the chopstick (the widest,
# flattest brown shape).
cr, cg = colour[..., 0], colour[..., 1]
brown = (alpha > 0) & (colour.sum(2) < 450) & (cr >= cg) & ((cr - cg) < 70)
parts, n = ndimage.label(brown & solid)
boxes = ndimage.find_objects(parts)
stick_id = max(
    range(1, n + 1),
    key=lambda i: (boxes[i - 1][1].stop - boxes[i - 1][1].start) / (boxes[i - 1][0].stop - boxes[i - 1][0].start),
)
stick = ndimage.binary_dilation(parts == stick_id, iterations=3) & brown
letters = brown & ~stick


def save(rgb_out, name):
    rgba = np.dstack([rgb_out, alpha * 255]).round().astype(np.uint8)
    image = Image.fromarray(rgba, "RGBA")
    image = image.crop(image.getbbox())
    image.save(f"{out_dir}/{name}", optimize=True)
    print(name, image.size)


save(colour, "bento-title.png")

dark = colour.copy()
dark[letters] = [241, 235, 229]  # the dark theme's text colour
wood = np.array([236, 196, 160])
dark[stick] = dark[stick] + (wood - dark[stick]) * 0.55
save(dark, "bento-title-dark.png")

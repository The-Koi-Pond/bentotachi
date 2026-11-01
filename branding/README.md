# Bentotachi's logo and title

Xel's originals (both made with ChatGPT, on a flat cream background):

- `Onigiri.png`: the mascot, a screaming onigiri skewered on chopsticks.
  The screaming is on purpose: Bentotachi doesn't take itself seriously.
- `BentotachiTitle.png`: the drawn "Bentotachi" title.
- `Umeboshi.png`: the pickled plum by the title's "B" (it replaced the
  title's sakura), on a glowing background the script cuts away.

(The old onigiri with the leaves and sakura, the title's sakura, and the
old "Bento" title are in the git history, before November 2026.)

The scripts turn them into what the app uses. Run them from the `web`
folder:

```
python ../branding/make_svg_title.py ../branding/BentotachiTitle.png ../branding/Umeboshi.png src/assets
python ../branding/make_svg_mascot.py ../branding/Onigiri.png src/assets
"C:\Program Files\Inkscape\bin\inkscape.com" src/assets/onigiri.svg --export-type=png --export-width=1024 --export-filename=<scratch folder>/onigiri.png
python ../branding/make_icons.py <scratch folder>/onigiri.png android/app/src/main/res public <scratch folder>
```

Copy the three SVGs (`bentotachi-title.svg`, `bentotachi-title-dark.svg`,
`onigiri.svg`) to `../site/` too, for the website.

- `make_svg_title.py` traces the title into clean SVGs:
  `bentotachi-title.svg` (dark letters) and `bentotachi-title-dark.svg`
  (cream letters, for dark mode), with the umeboshi traced from its own
  picture and placed by the "B".
- `make_svg_mascot.py` traces the onigiri into `onigiri.svg`, with a
  see-through background. Each part has its own id (chopsticks, body,
  shade, highlight, blush, eyes, outline-and-nori), and the eyes and blush
  are plain circles and ellipses, so moods can change them.
- Both need Python with Pillow and numpy (the mascot also scipy), and
  Inkscape 1.4, whose tracer does the curves.
- `make_ben_moods.py` makes Ben's moods (`ben-sweat.svg`, `ben-scream.svg`,
  `ben-bitten.svg`, `ben-ready.svg`, `ben-halo.svg`) from `onigiri.svg`:
  `python ../branding/make_ben_moods.py src/assets src/assets`. Run it again
  whenever onigiri.svg changes.
- `make_icons.py` makes the Android launcher icons (every density; the
  adaptive and round icons are sized so a round launcher doesn't cut off the
  chopstick ends), the Android launch screens, and the web tab icons in
  `public/`. It needs Pillow. The fourth folder gets a preview of the icon in
  circle and square shapes.

The colours: chopstick orange #C8643A (clear on both the light and dark
backgrounds), letters #361F17 or, in dark mode, #F1EBE5, and the leaf in
jade #5A9A8A with baran ridges (#3F7668 and #96C6B8). The icon background
colour is in `android/app/src/main/res/values/ic_launcher_background.xml`
(soft peach, #F6E4DA).

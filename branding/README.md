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
`onigiri.svg`) to the website too: the `bentotachi/` folder of The Koi
Pond's website repository (github.com/The-Koi-Pond/the-koi-pond.github.io).
Its home page also has its own copy of `onigiri.svg`.

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

The colours: chopstick wood #A87A43, with a #D4B07C shine on the title's
chopstick (clear on both the light and dark backgrounds; orange #C8643A
until 2026-11-04), letters #361F17 or, in dark mode, #F1EBE5, and the leaf
in jade #5A9A8A with baran ridges (#3F7668 and #96C6B8). The icon
background colour is in
`android/app/src/main/res/values/ic_launcher_background.xml` (soft peach,
#F6E4DA, also `ICON_BG` in make_icons.py); the launch screens use the
app's background, tea-rice #F3F6F4 (`SPLASH_BG`).

The website's Bentotachi link-preview card and phone icon
(`bentotachi/og-card.png`, `bentotachi/apple-touch-icon.png` in the website
repository) are drawn from these SVGs too: after copying the SVGs over, run
`python branding/make_bentotachi_page.py` in the website repository.

The page titles use Pond Pebbles, The Koi Pond's display font:
`web/src/assets/PondPebbles.woff2` is a copy of the studio's
(`font/PondPebbles.woff2` in the website repository, built by its
`font/make_font.py`). When the font changes there, copy it here again.

The Google Play pictures (`play/`: icon, banner, screenshots) come from
`make_play_listing.py`; docs/PLAY-LISTING.md says how.

The subreddit's banners (`reddit/banner-desktop.png`, 4000×480, and
`reddit/banner-mobile.png`, 1600×480) come from `reddit/banner.html`, which
draws Ben and the title from `web/src/assets`. To remake them, open it in a
browser window of exactly that size (`?size=desktop` or `?size=mobile`) and
screenshot the whole page. Everything that matters sits in the middle, as
Reddit crops banners to the screen's width.

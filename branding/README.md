# Bentotachi's logo and title

Xel's originals:

- `BentoLogo.png`: the onigiri (already has a see-through background).
- `BentotachiTitle.png`: the drawn "Bentotachi" title (made with ChatGPT),
  on a flat cream background. (The old "Bento" title and its script are in
  the git history, before November 2026.)

The scripts turn them into what the app uses. Run them from the `web`
folder:

```
python ../branding/make_svg_title.py ../branding/BentotachiTitle.png src/assets
python ../branding/make_icons.py ../branding/BentoLogo.png android/app/src/main/res public <any scratch folder>
```

- `make_svg_title.py` traces the title into clean SVGs:
  `src/assets/bentotachi-title.svg` (dark letters) and
  `bentotachi-title-dark.svg` (cream letters, for dark mode). It needs
  Python with Pillow and numpy, and Inkscape 1.4 (its tracer does the
  curves). Copy both files to `../site/` too, for the website.
- `make_icons.py` makes the Android launcher icons (every density, plus the
  adaptive icon sized so round launchers don't clip the leaf), the Android
  launch screens, and the web tab icons in `public/`. It needs Pillow, numpy
  and scipy. The fourth folder gets a preview of the icon in circle and
  square shapes.

`src/assets/bento-logo.png` (the login screen's onigiri) is the logo cropped
and shrunk to 360 px.

The colours: chopstick orange #C8643A (clear on both the light and dark
backgrounds), letters #361F17 or, in dark mode, #F1EBE5. The icon background
colour is in `android/app/src/main/res/values/ic_launcher_background.xml`
(soft peach, #F6E4DA).

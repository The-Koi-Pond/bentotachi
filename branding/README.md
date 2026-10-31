# Bento's logo and title

Xel's originals:

- `BentoLogo.png`: the onigiri (already has a see-through background).
- `BentoTitle.png`: the drawn "Bento" title, on a flat cream background.

The scripts turn them into what the app uses. They need Python with Pillow,
numpy and scipy. Run them from the `web` folder:

```
python ../branding/make_title.py ../branding/BentoTitle.png src/assets
python ../branding/make_icons.py ../branding/BentoLogo.png android/app/src/main/res public <any scratch folder>
```

- `make_title.py` cuts the title out of its background
  (`src/assets/bento-title.png`) and makes a dark-mode copy with cream
  letters and a lighter chopstick (`bento-title-dark.png`).
- `make_icons.py` makes the Android launcher icons (every density, plus the
  adaptive icon sized so round launchers don't clip the leaf), the Android
  launch screens, and the web tab icons in `public/`. The fourth folder gets
  a preview of the icon in circle and square shapes.

`src/assets/bento-logo.png` (the login screen's onigiri) is the logo cropped
and shrunk to 360 px.

The icon background colour is in
`android/app/src/main/res/values/ic_launcher_background.xml` (Bento's soft
peach, #F6E4DA).

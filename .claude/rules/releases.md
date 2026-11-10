---
paths:
  - "web/scripts/release.mjs"
  - "web/scripts/play.mjs"
  - "web/scripts/playUpload.mjs"
  - "web/scripts/package.mjs"
  - "web/scripts/package-files/**"
  - "web/scripts/buildTools.mjs"
  - "web/android/app/build.gradle"
  - "server/releases/**"
  - "server/pb_hooks/app_updates.pb.js"
---

# Releases, Google Play and the friends' zip

- Releases: `npm run release -- [patch|minor|major] "notes"`
  (web/scripts/release.mjs; patch is the default, 1.2.0 -> 1.2.1) bumps
  versionCode/versionName in app/build.gradle, builds, and publishes the APK
  plus latest.json to `server/releases/` (gitignored). The app checks
  `/api/cookbook/app/latest` (pb_hooks/app_updates.pb.js) on start and when
  resumed; BentoUpdaterPlugin.java downloads `/api/cookbook/app/download` and
  opens Android's installer. Updates only install if signed with the same
  key as the installed app: `android/keystore.properties` (gitignored)
  switches release builds to Bento's own key. Without it, release stops
  (unless `--test-key`, for a server whose phones all have test-key builds).
  Commit app/build.gradle after a release (it says so): otherwise the next
  release can reuse a version number phones already have.
  Then add the release to the website's "What's new" page and feed
  (`bentotachi/changelog.html` and `changelog.xml` in the website
  repository; its CLAUDE.md, "Bentotachi's changelog", says how), in plain
  words for people who use the app, and push it with Xel's go-ahead.
- The Google Play version: `npm run play` (web/scripts/play.mjs) builds an
  app bundle (`.aab`, at the path it prints) to upload in Play Console,
  signed with the same key (Play's "upload key"). It's the same app without
  self-updating, which Play forbids: the web part is built with
  `VITE_BENTO_PLAY=1` (`canSelfUpdate` in appUpdates.ts: its update banner and "Check for updates" ask Google Play instead, through
  Play's in-app updates, `updatesFromPlay`), the Android part with
  `-PbentoPlay` (no BentoUpdaterPlugin, and src/play/AndroidManifest.xml
  removes REQUEST_INSTALL_PACKAGES; the script checks it's gone). It uses
  build.gradle's version as it is, and Play needs a higher one per upload,
  so `npm run release` first when there's something new. A test copy of the
  Play version: `VITE_BENTO_PLAY=1 npm run android`, then
  `gradlew assembleDebug -PbentoTest -PbentoPlay`.
- `npm run play -- upload internal,alpha "notes"` also uploads it to those
  testing tracks (alpha is closed testing) through Play's upload robot
  (web/scripts/playUpload.mjs; a Google Cloud service account invited in
  Play Console with "Release apps to testing tracks", set up 2026-11-07).
  Its key is web/android/play-publisher.json, gitignored like the signing
  key: never commit, print or send it. Uploading reaches testers, so only
  with Xel's go-ahead, like a release.
- Release, play and package refuse while the web app or server code has
  uncommitted changes, like deploy (see CLAUDE.md, "Sending it out");
  release and play also while `web/android` or `mobile/` has, as both go
  into the app. Release runs the phone server's Go tests before rebuilding
  it (server-lib.mjs).
- The friends' zip (`npm run package`) uses
  web/scripts/package-files/Start Bentotachi.bat; `server/Start Bentotachi
  here.bat` is the PC's fallback (asks for YES).
- The Android app itself: `.claude/rules/android.md`.

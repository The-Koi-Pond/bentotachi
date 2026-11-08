---
paths:
  - "web/android/**"
  - "mobile/**"
  - "web/capacitor.config.ts"
  - "web/src/phoneMode.ts"
  - "web/src/appUpdates.ts"
  - "web/src/playUpdates.ts"
  - "web/src/bentoBrowser.ts"
  - "web/src/scanner.ts"
  - "web/src/saveFile.ts"
  - "web/src/shareReceiver.ts"
---

# The Android app

- Capacitor 8 wraps `web/` into `web/android/` (app ID `com.xel.bento`).
  `npm run android` (in `web`) builds into `web/dist/` and copies it into the
  Android project. In the app, `isAndroidApp` is true and the server address
  comes from the login screen (saved as `bento.serverUrl`).
- Build from the command line with Android Studio's Java 21. The PC's own
  `JAVA_HOME` points at Java 17, which is too old:
  `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` then
  `.\gradlew.bat assembleDebug` in `web\android`. The APK lands in
  `app\build\outputs\apk\debug\`. (The scripts use web/scripts/buildTools.mjs
  for this.)
- Native code, registered in MainActivity: BrowserActivity +
  BentoBrowserPlugin (built-in browser, Save to Bento), BentoUpdaterPlugin
  (app updates), BentoSharePlugin (links shared to Bento), BentoScannerPlugin
  (barcodes, Google's scanner: no camera permission), BentoFilesPlugin
  (saving exports), BentoLocalServerPlugin (phone-only mode).
- Phone-only mode ("Just me, on this phone"): the Pi's same server runs
  inside the app on 127.0.0.1 (mobile/bentoserver, Go; see
  mobile/README.md). **Every APK carries `server/pb_hooks` and
  `server/pb_migrations`** (Gradle task copyBentoServerCode in
  android/app/build.gradle), so a hook or migration change also runs on
  phones, on data with no admin page to fix it. `npm run android` needs Go,
  the Android NDK and gomobile (web/scripts/server-lib.mjs builds
  `app/libs/bentoserver.aar`, without which the APK doesn't build). The Go
  tests: `go test ./...` in `mobile`. web/src/phoneMode.ts is the app's
  side (the saved account, backups). Tried on a real phone (Pixel 7 Pro,
  2026-11-01 and 11-03, including updating with data in it).
- `androidScheme: "http"` must never change (it would wipe phones' saved
  login). Keep `cleartext: true` while any server is plain http: the Pi on
  its Tailscale address, friends' servers on home Wi-Fi, and phone-only
  mode (always http://127.0.0.1). Turning it off would break all of them.
- For Xel to look around on a phone screen: `node scripts/emulator.mjs`
  (desktop shortcuts "Bentotachi Emulator" and "Bentotachi phone size")
  builds the newest commit's Play test copy in its own worktree
  (`%LOCALAPPDATA%\Bentotachi emulator\copy`; don't work in it) and opens it
  in the "Bentotachi" emulator (a virtual Pixel 7 Pro). `size big|small|tiny`
  and `text big|normal` change its screen and text size while it runs.
- Releases and the Google Play version: `.claude/rules/releases.md`.

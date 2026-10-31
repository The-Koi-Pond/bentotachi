# Bento: handoff guide

**Bento** is a shared cookbook / shopping list / pantry app for Xel's
household of three. The folder, `web/package.json` name and the
`/api/cookbook/import` route keep the old "cookbook" name on purpose (internal
only); use "Bento" in anything people see.
Xel has minimal hands-on coding experience: write the code, explain choices
plainly, and give copy-pasteable steps. Roadmap and status: `docs/PLAN.md`.
How to run: `README.md`.

## Layout

- `server/`: PocketBase v0.40.6 (the `.exe` is downloaded, not committed).
  - `pb_migrations/*.js`: database schema, applied in filename order on start.
    Base collections only get an `id` field automatically, so add `created` /
    `updated` autodate fields yourself.
  - `pb_hooks/*.pb.js`: server routes. Each handler runs in its own scope and
    can't see outer variables, so `require(`${__hooks}/file.js`)` inside it.
  - `pb_hooks/recipe_parse.js`: not a hook (no `.pb.js`), a helper shared by
    the import route and the Node tests. Keep it plain CommonJS without `?.`,
    `??` or other recent syntax, because PocketBase's JS engine is older.
  - `pb_hooks/pantry.pb.js`: server rules linking pantry and shopping list.
  - `test/`: `node --test "server/test/*.test.js"` from the project folder.
    `test/pantry-rules.check.mjs` checks the server rules end to end against
    a throwaway PocketBase on port 8091 (instructions at its top). Claude can
    run the already-downloaded `pocketbase.exe` with `--dir` in scratch
    space for this; never test against `server/pb_data` (the real data).
- `web/`: React + Vite + TypeScript, React Router 8 (a hash router, so no
  server routing setup is needed; it's a data router from
  `createHashRouter` in `App.tsx` so `useBlocker` works for the
  unsaved-changes prompt in `unsavedChanges.ts`, with the pages still listed
  as `<Routes>` inside). `npm run build` writes to
  `server/pb_public/`, which PocketBase serves. `npm run dev` proxies `/api`
  to port 8090.
  - Don't give a logic file and a component the same name in different case
    (`softText.ts` / `SoftText.tsx`): Windows sees one file and the build
    fails. Name the logic one differently (`softMarks.ts`, `cookTiming.ts`).

## Android app

- Capacitor 8 wraps `web/` into `web/android/` (app ID `com.xel.bento`).
  `npm run android` (in `web`) builds into `web/dist/` and copies it into the
  Android project. In the app, `isAndroidApp` is true and the server address
  comes from the login screen (saved as `bento.serverUrl`).
- Build from the command line with Android Studio's Java 21. The PC's own
  `JAVA_HOME` points at Java 17, which is too old:
  `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` then
  `.\gradlew.bat assembleDebug` in `web\android`. The APK lands in
  `app\build\outputs\apk\debug\`.
- Releases: `npm run release -- [patch|minor|major] "notes"` (web/scripts/release.mjs; patch is the default, 1.2.0 -> 1.2.1) bumps
  versionCode/versionName in app/build.gradle, builds, and publishes the APK
  plus latest.json to `server/releases/` (gitignored). The app checks
  `/api/cookbook/app/latest` (pb_hooks/app_updates.pb.js) on start and when
  resumed; BentoUpdaterPlugin.java downloads `/api/cookbook/app/download` and
  opens Android's installer. Updates only install if signed with the same
  key as the installed app: `android/keystore.properties` (gitignored)
  switches release builds to Bento's own key.
- The live server is the Raspberry Pi (`~/bento/server`, systemd service
  `bento`); see README "Where Bento runs". Its address and login are in
  `web/scripts/pi.json` and `CLAUDE.local.md`, both private (gitignored):
  this repository is public, so never commit the household's addresses,
  logins, network names or people's names (use made-up examples).
  `npm run deploy` sends changes there (Xel allowed Claude to run it,
  2026-10-30; say when you do, since Bento blinks off for a few seconds),
  `npm run backup` pulls its nightly backups. The PC's
  `server/pb_data` is a stale pre-move copy; test on throwaway servers.
  The friends' zip uses web/scripts/package-files/Start Bento.bat.
- Native code: BrowserActivity + BentoBrowserPlugin (built-in browser, Save
  to Bento), BentoUpdaterPlugin; registered in MainActivity.
- `androidScheme: "http"` must never change (it would wipe phones' saved
  login). `cleartext: true` is only for the PC-on-Wi-Fi phase; turn it off
  once the Pi has its Tailscale HTTPS address.

## Conventions

- Ingredients, steps and tags are stored as JSON lists of strings. A line
  starting with `#` is a heading.
- All collections allow any logged-in household member to read and write.
- Pages that show shared lists use `useLiveRecords` (load + live updates +
  reload when the app returns to the front).
- User-facing error text should say what happened and what to do next.

## Environment notes

- Claude's auto mode blocked downloading and running the PocketBase program,
  so Xel runs PocketBase themself (README steps).
- Verify before claiming it works. The server side (migration, import route)
  only gets truly checked by running PocketBase.

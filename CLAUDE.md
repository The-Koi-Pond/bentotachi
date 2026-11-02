# Bento: handoff guide

**Bentotachi** ("Bento" for short) is a shared cookbook / shopping list /
pantry app for Xel's household of three. Renamed from Bento on 2026-11-01:
use "Bentotachi" in anything people see (the repository, website, folder,
guide and server window followed on 2026-11-02). Internal names keep
"bento" (app ID `com.xel.bento`, `bento.*` storage keys, plugin and Go
names, the Pi's `~/bento` folder and `bento` service); changing the app ID
would make phones treat it as a different app, and changing the storage
keys would lose everyone's saved settings. `web/package.json`'s name and
the `/api/cookbook/...` routes keep the older "cookbook" name. The folder
is `C:\Projects\TheKoiPond\bentotachi` (it was `C:\Projects\Cookbook`, then
`...\TheKoiPond\bento`), next to The Koi Pond's other projects: see
`C:\Projects\TheKoiPond\README.md`.
Xel has minimal hands-on coding experience: write the code, explain choices
plainly, and give copy-pasteable steps. Roadmap and status: `docs/PLAN.md`.
What Bentotachi is, its promises, voice (cheeky, but the joke never
replaces the information) and look: `docs/VISION.md`. Check new screens,
wording and features against it.
How to run: `README.md`.

## Layout

- `server/`: PocketBase v0.40.6 (the `.exe` is downloaded, not committed).
  - `pb_migrations/*.js`: database schema, applied in filename order on start.
    Base collections only get an `id` field automatically, so add `created` /
    `updated` autodate fields yourself.
  - `pb_hooks/*.pb.js`: server routes. Each handler runs in its own scope and
    can't see outer variables, so `require(`${__hooks}/file.js`)` inside it.
  - `pb_hooks/recipe_parse.js`: not a hook (no `.pb.js`), a helper shared by
    the import route and the Node tests. Helpers like it are plain CommonJS
    (`module.exports`, `require`), since PocketBase's JS engine has no
    `import`. `?.` and `??` do work there (both checked on 0.40.6;
    household.pb.js uses `??`); older files avoid them only because an older note said so.
  - `pb_hooks/pantry.pb.js`: server rules linking pantry and shopping list.
  - `test/`: `node --test "server/test/*.test.js"` from the project folder.
    The `*.check.mjs` files (pantry rules, who added, meals, expired login,
    import limits, pantry photos, setup usernames) check the server end to
    end against a throwaway
    PocketBase on port 8091, or `BENTO_TEST_PORT` (instructions at the top
    of `pantry-rules.check.mjs`). `npm run release` and `npm run deploy` run
    them all on their own throwaway server (web/scripts/tests.mjs, port
    8099, deleted afterwards); a new check file is picked up by itself, but
    must print a PASS line per check, FAIL on failure, and pick unique
    names (they share one server; pantry-rules runs first). Claude can
    run the already-downloaded `pocketbase.exe` with `--dir` in scratch
    space for this; never test against `server/pb_data` (the real data).
    Always add `--automigrate=false`: without it, changing a collection's
    settings on a test server writes a migration file into `pb_migrations`
    that would change the real database (deploy, release and package refuse
    uncommitted files there, web/scripts/committed.mjs, but don't rely on
    it). Tell any reviewer agent the same.
- Code reviews: `docs/REVIEW-NOTES.md` lists findings already checked and
  dismissed (with why, and when to reopen), and starts with what reviewers
  need to know about this project. Give it to reviewers and check findings
  against it before reporting; add to it whenever Xel or a verification
  dismisses one. Real bugs and review findings waiting to be fixed go in
  `TODO.md` at the repository root: kept on this PC only (listed in
  `.git/info/exclude`, never committed), so findings that aren't ready to
  share stay off GitHub. Planned features stay in `docs/PLAN.md`.
- `web/`: React + Vite + TypeScript, React Router 8 (a hash router, so no
  server routing setup is needed; it's a data router from
  `createHashRouter` in `App.tsx` so `useBlocker` works for the
  unsaved-changes prompt in `unsavedChanges.ts`, with the pages still listed
  as `<Routes>` inside). `npm run build` writes to
  `server/pb_public/`, which PocketBase serves. `npm run dev` proxies `/api`
  to port 8090.
  - Tests: `node --test "test/*.test.ts"` from `web`. **`npm test`** (from
    `web`) runs everything below on its own (web/scripts/run-tests.mjs),
    without building or sending anything: use it before saying it works.
    `npm run release` and `npm run deploy` run both suites first, the date
    tests again in two far-off time zones, and the server's end-to-end
    checks (web/scripts/tests.mjs, about 10 seconds), and stop if any test
    fails or none are found.
  - What makes logic testable: `node --test` loads the real `.ts` files with
    no Vite in between, so a tested module imports other modules with their
    `.ts` ending (`from "./stepTimers.ts"`) and takes only types from `pb.ts`
    (`import type`), since loading `pb.ts` loads Capacitor. Keep rules in
    such modules, not inside pages (`.tsx` can't be imported by the tests).
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
  switches release builds to Bento's own key. Without it, release stops
  (unless `--test-key`, for a server whose phones all have test-key builds).
  Commit app/build.gradle after a release (it says so): otherwise the next
  release can reuse a version number phones already have.
  Deploy refuses to send if a folder (like `server/releases`) is missing
  here, and the Pi only swaps folders in once all of them have arrived.
- The website (github.com/The-Koi-Pond/bentotachi → thekoipond.dev/bentotachi,
  since 2026-11-02; it was /bento before the repository was renamed, and
  the home page repository's `bento/` folder redirects old links) is the
  `site/` folder, published by `.github/workflows/pages.yml` on push.
  The domain's home page is its own repository,
  github.com/The-Koi-Pond/the-koi-pond.github.io (C:\Projects\TheKoiPond\the-koi-pond.github.io);
  the domain is Xel's, at Cloudflare.
  `site/privacy.html` is the Google Play privacy policy. Never delete
  `site/google11869a0aeef0ff1c.html` (or its copy in the home page's
  `bento/` folder): it's the Search Console ownership check, and Google
  re-checks it.
- The live server is the Raspberry Pi (`~/bento/server`, systemd service
  `bento`); see README "Where it runs". Its address and login are in
  `web/scripts/pi.json` and `CLAUDE.local.md`, both private (gitignored):
  this repository is public, so never commit the household's addresses,
  logins, network names or people's names (use made-up examples).
  `npm run deploy` sends changes there (Xel allowed Claude to run it,
  2026-10-30; say when you do, since Bento blinks off for a few seconds),
  `npm run backup` pulls its nightly backups. The PC's
  `server/pb_data` is a stale pre-move copy; test on throwaway servers.
  The friends' zip uses web/scripts/package-files/Start Bentotachi.bat;
  `server/Start Bentotachi here.bat` is the PC's fallback (asks for YES).
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
  side (the saved account, backups). Not yet tried on a real phone.
- `androidScheme: "http"` must never change (it would wipe phones' saved
  login). Keep `cleartext: true` while any server is plain http: the Pi on
  its Tailscale address, friends' servers on home Wi-Fi, and phone-only
  mode (always http://127.0.0.1). Turning it off would break all of them.

## Conventions

- Ingredients, steps and tags are stored as JSON lists of strings. A line
  starting with `#` is a heading.
- All collections allow any logged-in household member to read and write.
- Pages that show shared lists use `useLiveRecords` (load + live updates +
  reload when the app returns to the front). The recipe list and categories
  don't yet: they load when opened (TODO.md has it).
- User-facing error text should say what happened and what to do next.

## Environment notes

- Claude can run the already-downloaded `server/pocketbase.exe` on a
  throwaway folder (see `test/` above); downloading a new PocketBase was
  blocked by auto mode once, so Xel does that.
- Verify before claiming it works. The server side (migration, import route)
  only gets truly checked by running PocketBase.

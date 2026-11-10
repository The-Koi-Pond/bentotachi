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
Roadmap and status: `docs/PLAN.md`; what each release brought:
`docs/RELEASES.md` (releases are tagged `v1.23.0` in git).
Where Google Play stands (what's done and what's open: the closed test,
production access, the store listing): `docs/PLAN.md`, stage 8, kept
current at each step. Check it before saying something for Play is
missing. `docs/REVIEW.md` is the 2026-10-31 check-up behind it (privacy,
account deletion, phone-only mode), with its reasons.
What Bentotachi is, its promises, voice (cheeky, but the joke never
replaces the information) and look: `docs/VISION.md`. Check new screens,
wording and features against it. For app text, its voice wins over the
global writing rules (`~/.claude/rules/writing.md`) where they differ.
Shared helpers and components, riskiest first: `docs/shared-systems.md`.
How to run: `README.md`.

## Layout

- `server/`: PocketBase v0.40.6 (the `.exe` is downloaded, not committed):
  `pb_migrations/` (the database schema), `pb_hooks/` (server routes and
  rules), `test/` (unit tests and end-to-end `*.check.mjs` files). How to
  write and test them: `.claude/rules/server.md`, which loads with them.
  Never test against `server/pb_data` (a stale copy of real data), and
  always give a throwaway server `--automigrate=false` (server.md says why).
- Real bugs and review findings waiting to be fixed go in `TODO.md` at the
  repository root: kept on this PC only (listed in `.git/info/exclude`,
  never committed), so findings that aren't ready to share stay off GitHub.
  Planned features stay in `docs/PLAN.md`.
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

## Sending it out

The details load by themselves when a session opens the files they cover
(`.claude/rules/`). **Read the file first** when doing that job without
opening one of them (running a command counts):

- Building the APK, native code, phone-only mode, the emulator, Capacitor
  settings: `.claude/rules/android.md`.
- Releasing an APK, the Google Play version and its upload robot, the
  friends' zip: `.claude/rules/releases.md`.
- Deploying to the Pi, backups, fixing data with pi-admin, trying a
  migration on a copy of real data: `.claude/rules/pi.md`.

What every session needs anyway:

- Deploy: `npm run deploy` (in `web`) sends the server code and web app to
  the Pi (Xel allowed Claude to run it, 2026-10-30; say when you do, since
  Bento blinks off for a few seconds). Deploy, release, play and package
  refuse while the web app or the server code has uncommitted changes, and
  release and play also while the Android code or the phone server
  (`mobile/`) has (web/scripts/committed.mjs), since other sessions often work in this
  folder: commit your own work first. A release or Play upload reaches
  phones, so only with Xel's go-ahead.
- **Every APK carries `server/pb_hooks` and `server/pb_migrations`**
  (phone-only mode runs the same server inside the app), so a hook or
  migration change also runs on phones, on data with no admin page to fix
  it.
- This repository is public: never commit the household's addresses,
  logins, network names or people's names (use made-up examples). The
  Pi's details are in `web/scripts/pi.json` and `CLAUDE.local.md`, both
  private (gitignored).
- The website (thekoipond.dev/bentotachi) is **not in this repository**:
  it's the `bentotachi/` folder of The Koi Pond's website repository
  (C:\Projects\TheKoiPond\the-koi-pond.github.io; its CLAUDE.md says how
  it's published). Never turn GitHub Pages on for this repository: it
  would take over thekoipond.dev/bentotachi. `bentotachi/privacy.html`
  there is the Google Play privacy policy: when the app starts doing
  something new with people's data, update it (its own commit and push,
  in that repository). Never delete its `google11869a0aeef0ff1c.html`:
  it's the Search Console ownership check.
- `androidScheme: "http"` and `cleartext: true` in capacitor.config.ts must
  never change (android.md says why).

## Conventions

- Ingredients, steps and tags are stored as JSON lists of strings. A line
  starting with `#` is a heading.
- All collections allow any logged-in household member to read and write.
- Pages that show shared lists use `useLiveRecords` (load + live updates +
  reload when the app returns to the front), the recipe list included; an
  offline copy is one of offline.ts's ready-made `copy` objects.
- The "(Xel, 2026-11-08)" credit style is for docs/PLAN.md only, never code
  comments: a comment says why, and web/test/noCommentCredits.test.ts fails
  on a who-asked-and-when credit.

## Environment notes

- Claude can run the already-downloaded `server/pocketbase.exe` on a
  throwaway folder (`.claude/rules/server.md`); downloading a new PocketBase was
  blocked by auto mode once, so Xel does that.
- The server side (migration, import route) only gets truly checked by
  running PocketBase.

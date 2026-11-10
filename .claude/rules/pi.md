---
paths:
  - "web/scripts/deploy.mjs"
  - "web/scripts/backup.mjs"
  - "web/scripts/pi-admin.mjs"
  - "web/scripts/piConfig.mjs"
  - "web/scripts/committed.mjs"
  - "backups/**"
---

# The Pi: the live server

- The live server is the Raspberry Pi (`~/bento/server`, systemd service
  `bento`); see README "Where it runs". Its address and login are in
  `web/scripts/pi.json` and `CLAUDE.local.md`, both private (gitignored).
- `npm run deploy` sends changes there (Xel allowed Claude to run it,
  2026-10-30; say when you do, since Bento blinks off for a few seconds).
  Deploy refuses to send if a folder (like `server/releases`) is missing
  here, and the Pi only swaps folders in once all of them have arrived.
  Deploy, release, play and package also refuse while the web app (`web/`,
  apart from `web/android` and `web/scripts`) or the server code has
  uncommitted changes, and release and play also while the Android code
  (`web/android`) or the phone server (`mobile/`) has
  (web/scripts/committed.mjs): Xel often runs several
  sessions in this folder, and the build takes files as they are, so
  another session's half-finished work would go out too. Commit your own
  work; if the rest is another session's, wait for it, or deploy from a
  clean copy (the project memory note on deploying beside other sessions).
- `npm run backup` pulls its daily backups to `backups/pi`. The Pi makes
  them at 03:30 UTC (PocketBase's schedules run in UTC, not the Pi's local
  time), so in Australia that's the afternoon, not the middle of the night.
- Fixing data the app can't (a one-off script, like 2026-11-05's pantry
  tidy-up): `npm run pi-admin -- <script.mjs>` (web/scripts/pi-admin.mjs)
  adds a temporary admin login, backs up, runs the script and removes the
  login. Claude's permissions block adding logins on the Pi, so Xel runs
  that command; try the script on a throwaway copy of a backup first.
- A migration that changes existing data: try it on a throwaway copy of the
  newest backup first (unzip it into scratch space, run pocketbase.exe on
  it with `--automigrate=false`, read counts only, then delete the copy).
- The PC's `server/pb_data` is a stale pre-move copy; test on throwaway
  servers.

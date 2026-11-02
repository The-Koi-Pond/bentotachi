# Review notes: settled findings

Things code reviews have raised that were checked and deliberately left as
they are, so later reviews don't report them again. **Reviewers: read this
before reporting.** A finding listed here is only worth raising again if the
"reopen if" condition has happened, or you can show the reason no longer
holds; say which.

Real bugs waiting to be fixed are in `TODO.md` at the repository root (on
the PC only, not on GitHub), not here: don't report those as new either.

## For reviewers: this project

Standing facts every reviewer of Bentotachi needs. Whoever starts a review
hands this section on rather than retyping it; if something here is wrong,
fix it here so the next review gets it right.

- **What it is:** a recipe, meal plan, shopping list and pantry app for one
  household of three (Android app and PC browsers), on a Raspberry Pi at
  home reached over Tailscale. Friends can run their own copy from a zip on
  a Windows PC, and "phone-only mode" runs the same server inside the app.
  CLAUDE.md is the full guide.
- **Severity:** realistic likelihood x impact for a household on a home
  server, not an enterprise or hostile-attacker setting. Data loss,
  corruption, leaked private details and anything reachable from the
  internet still count.
- **Scope:** the quality of what exists. Missing or unfinished features
  aren't findings unless they break or endanger something in use.
- **Never:** run anything against `server/pb_data` or the Pi; run release,
  package, deploy or backup; read or print `web/android/keystore.properties`,
  `CLAUDE.local.md` or `web/scripts/pi.json` (checking they're gitignored is
  fine). Reviews are read-only: no edits to the project.
- **A test server:** `server/pocketbase.exe` with `--dir` in your own scratch
  folder, always `--automigrate=false` (commands at the top of
  `server/test/pantry-rules.check.mjs`), on a port nobody else uses (not
  8091, 8099).
- **Scratch work:** each reviewer works in its own subfolder of the scratch
  space. Write scratch scripts with the Write tool (heredocs, `node -e` and
  `sed -i` are blocked by a hook); without Write, `printf '%s\n' ... > file`
  or `sed '...' original > copy` into the scratch folder works. A copy of the code that needs `web/node_modules`
  can link to it; remove the link with `cmd /c rmdir <link>`, never
  `rm -rf`, which can delete the real folder through the link.
- **Tests:** `npm test` from `web` runs everything, including the
  end-to-end checks on its own throwaway server (port 8099 unless
  `BENTO_CHECK_PORT` says otherwise: set it to your own port, e.g.
  `BENTO_CHECK_PORT=8133 npm test` in bash, `$env:BENTO_CHECK_PORT=8133;
  npm test` in PowerShell). Or one suite at a time:
  `node --test "server/test/*.test.js"` from the project folder,
  `node --test "test/*.test.ts"` from `web`.
- **Branches:** only `main`. The old pre-public history is a separate folder
  (`C:\Projects\TheKoiPond\bento-history`), not a branch.

## Checked and found fine (no need to check again)

From a read-only bug hunt on 2026-11-01 (by reading the code, not running
it), with what guards each one, checked 2026-11-02. Reopen if the code
named here changes in a way that matters. Everything marked *Guarded*
runs on every release and deploy (web/scripts/tests.mjs): the unit tests,
the date tests again in two far-off time zones, and the
`server/test/*.check.mjs` end-to-end checks on a throwaway server.

- **Dates** (web/src/dates.ts, expiry.ts): stored and compared as plain
  `YYYY-MM-DD`, so time zones can't shift them by a day; the week start and
  month maths are right. *Guarded:* web/test/dates.test.ts and
  expiry.test.ts (month and year ends, week starts, local "today", days
  until expiry), run in this PC's time zone and again in Kiritimati
  (UTC+14) and Pago Pago (UTC-11).
- **Unit conversions** (weights.ts, volumes.ts): tablespoons (15 vs 20 ml),
  cups, US and UK pints, quarts, gallons, pounds and ounces are right.
  *Guarded:* web/test/weights.test.ts, volumes.test.ts, dutch.test.ts.
- **Import address safety** (server/pb_hooks/safe_url.js): private IPs,
  localhost, number-only and bracketed addresses are refused. Its known gap
  (a public name that points or redirects to a home address) is written
  down in the file; PocketBase can't check where a name points. *Guarded:*
  server/test/safe_url.test.js (20 refused addresses, including
  2130706433, 0x7f000001, [::1], .local, .lan and Tailscale names).
- **Access rules**: ratings can only be changed by their owner, adding
  people needs a logged-in member, and first-time setup is guarded inside a
  transaction. *Guarded:* pantry-rules.check.mjs tests ratings (others
  can't change, delete, hand over or create yours), sign-up closed to the
  public, a member adding someone, and a set-up server not offering setup
  again. *Not tested, on purpose (Xel, 2026-11-02: not a realistic case):*
  two people setting up the same brand-new server at the same moment (the
  transaction); by reading the code only.
- **Undo** (web/src/pendingDelete.ts, shown by undo.tsx): a pending delete
  is carried out when its time is up, when you leave the page, or when
  another removal replaces it; Undo cancels it. *Guarded:*
  web/test/pendingDelete.test.ts, with a clock the test moves by hand. Four
  deliberate breaks of a copy (Undo deleting anyway, deletes never
  happening, a new removal not carrying out the old one, leaving cancelling)
  were each caught. Also tried in Chromium and Firefox on the shopping list.

## Not bugs (checked, the claim doesn't hold)

- **A queued shopping change that keeps failing with 500 or 403 blocks the
  rest of the queue forever.** PocketBase answers failed rules with 400/404,
  not 403, and turns ordinary errors into 400; there's no proxy in front of
  it; a restart is a refused connection (offline). A lasting 500 isn't a
  realistic state. (Review of d2efa52, 2026-11-02.) Reopen if: a reverse
  proxy or an outside service gets put in front of the server.
- **The phone server's hooks being copied again while it runs breaks it.**
  PocketBase holds the hooks in memory once started. (Review of 1.12.0,
  2026-11-02.)
- **An expired login at app start sends the offline queue as a guest.**
  `useCurrentUser` checks the login's expiry on start, so the login screen
  shows first. (Review of d2efa52.) The case that was real (the login
  expiring while the app stays open) is handled by `web/src/session.ts`.
- **The pantry edit form lost its "the server didn't keep everything, it
  needs restarting" check, so a not-restarted server silently drops new
  fields like more_store_urls.** Removed on purpose in 6f66654 (a324a75
  removed the same check elsewhere as wrong advice on the Pi and in phone
  mode); it never covered more_store_urls; and a not-restarted server
  doesn't happen in normal use: deploy restarts the service (deploy.mjs
  `systemctl restart bento`), the friends' zip and phone-only mode start
  fresh. (Review of the pantry redesign work, 2026-11-02.) Reopen if: a way
  to update the server's files without restarting it becomes normal.

## Not worth changing (real, but too small or too unlikely)

- **The short expiry badge's boundaries aren't tested** (the 14-day cut-off
  between "6 days" and "12 Dec", and yesterday's wording): mutating either
  passed the tests, but it's wording only. (Review of the pantry redesign
  work, 2026-11-02.)

- **`npm run release` then `npm run deploy` runs both test suites twice.**
  It costs under half a second next to the builds. (Review of d2efa52.)
- **The APK download holds the whole APK in memory.** About 16 MB, fine on
  the Pi. (Review of 1.12.0.) Reopen if: the APK grows past ~100 MB.
- **useLiveRecords' reload has no ordering guard**, so an older list can
  briefly replace a newer one; the next live update corrects it. (Review of
  1.12.0.)
- **Importing a link reads the page or photo whole into memory, with no
  size limit** (PocketBase's `$http.send` reads everything; the 10 MB photo
  check runs after the download). Only a logged-in member pasting a link to
  a huge file could trigger it, the 20-second timeout bounds it, and the
  service restarts itself. (Audit 2026-11-02, verified.) Reopen if: the
  server becomes reachable from the internet, or runs on a Pi with under
  1 GB of memory.
- **Nothing checks that the Pi's PocketBase version matches the PC's.** It
  only matters when someone upgrades one side by hand. (Audit 2026-11-02.)
  Reopen if: PocketBase is being upgraded (then compare `pocketbase
  --version` on both, or add that check to deploy).
- **Deploy would accept a local `server/releases` whose latest.json names an
  APK that isn't there.** Nothing in the scripts leaves it in that state
  (release copies the APK before writing latest.json; backup never touches
  releases); only deleting the APK by hand would. (Review of d2efa52.)

## Chosen behaviour (looks odd, decided on purpose)

- **Scaling changes unit words but not other words**: "1 egg" x2 is
  "2 egg". Paprika does the same; guessing English plurals goes wrong more
  often than it helps. Juice and zest of citrus are the exception ("juice
  of 2 lemons"), since those lines are common and the fruit list is short.
  Other fruit ("juice of 1 apple") isn't scaled. Known, rare mismatches
  left as they are (review of edfce47): "juice of 1 can of mandarin
  oranges" x2 gives "2 can of mandarins oranges", and "juice of 2 lemon
  wedges" x2 gives "4 lemons wedges".
- **A dot before three digits is Dutch thousands only for g, ml and cl**
  ("1.000 g" is a thousand grams); for kilos, litres or no unit it's a
  decimal ("1.250 kg" is one and a quarter). An English "1.250 g" would be
  read as 1250 g; three decimals of a gram doesn't happen in recipes.
- **Amounts inside the method aren't scaled**, only ingredients; the page
  says so.
- **Lists load on a login confirmed in the last minute without asking the
  server again** (web/src/loginGuard.ts). A login revoked within that
  minute (a password changed on another phone) could load one empty list;
  the next check signs out and clears the phone's copies anyway, and sending
  changes always checks fresh, so nothing is lost. Asking on every load
  would double the requests.
- **While offline changes are being sent, tapping an item with a change on
  its way shows "one moment"** instead of acting. Sending takes about a
  second, and acting could add an item twice or undo a newer tick.
- **Internal names stay "bento"** (com.xel.bento, `bento.*` storage keys,
  the Pi's `bento` service): renaming them would make phones treat the app
  as a new one and lose everyone's settings. See CLAUDE.md.

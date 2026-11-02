# Review notes: settled findings

Things code reviews have raised that were checked and deliberately left as
they are, so later reviews don't report them again. **Reviewers: read this
before reporting.** A finding listed here is only worth raising again if the
"reopen if" condition has happened, or you can show the reason no longer
holds; say which.

Real bugs waiting to be fixed are in `docs/PLAN.md` ("To fix later"), not
here.

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
  realistic state. (Review of 542b648, 2026-11-02.) Reopen if: a reverse
  proxy or an outside service gets put in front of the server.
- **The phone server's hooks being copied again while it runs breaks it.**
  PocketBase holds the hooks in memory once started. (Review of 1.12.0,
  2026-11-02.)
- **An expired login at app start sends the offline queue as a guest.**
  `useCurrentUser` checks the login's expiry on start, so the login screen
  shows first. (Review of 542b648.) The case that was real (the login
  expiring while the app stays open) is handled by `web/src/session.ts`.

## Not worth changing (real, but too small or too unlikely)

- **`npm run release` then `npm run deploy` runs both test suites twice.**
  It costs under half a second next to the builds. (Review of 542b648.)
- **The APK download holds the whole APK in memory.** About 16 MB, fine on
  the Pi. (Review of 1.12.0.) Reopen if: the APK grows past ~100 MB.
- **useLiveRecords' reload has no ordering guard**, so an older list can
  briefly replace a newer one; the next live update corrects it. (Review of
  1.12.0.)
- **Deploy would accept a local `server/releases` whose latest.json names an
  APK that isn't there.** Nothing in the scripts leaves it in that state
  (release copies the APK before writing latest.json; backup never touches
  releases); only deleting the APK by hand would. (Review of 542b648.)

## Chosen behaviour (looks odd, decided on purpose)

- **Scaling changes unit words but not other words**: "1 egg" x2 is
  "2 egg". Paprika does the same; guessing English plurals goes wrong more
  often than it helps. Juice and zest of citrus are the exception ("juice
  of 2 lemons"), since those lines are common and the fruit list is short.
  Other fruit ("juice of 1 apple") isn't scaled. Known, rare mismatches
  left as they are (review of 34d60db): "juice of 1 can of mandarin
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

# Bento review (2026-10-31)

A whole-app look before offering Bento to people outside our household:
gaps our own use doesn't show, and how Bento compares with the well-known
apps. Tick things off here as they're done (and note them in PLAN.md's
"Waiting for the next app release" list as usual).

## How Bento compares (October 2026)

Bento is ahead of Paprika 3 on: separate logins per person (Paprika 3 has
one shared account), a pantry linked to recipes and the shopping list,
barcode scanning, cooking history ("Last had…"), spoon/unit/regional-name
hints, and being free with no company account or tracking.

Paprika is ahead on: scaling servings, timers you tap in the method, bulk
export and import (`.paprikarecipes` is the format people move recipes
in), a shopping list sorted by aisle with duplicates combined, breakfast
and lunch in the plan, iPhone and desktop apps, and 16 languages.

Worth knowing:
- Paprika 4 went to open beta on 2026-09-28 (paprikaapp.com/news). Its
  paid "Premium" adds barcode scanning, family accounts, photo scanning and
  nutrition, so Bento being free and private is a real selling point.
- Self-hosted Mealie and Tandoor have more features (Tandoor imports ~23
  formats) but need Docker and a server, and don't work offline.
- AnyList: great shared lists, no bulk export. Plan to Eat: planning
  first, no free tier. Samsung Food: free with ads and tracking.
- What people expect in 2026: one-tap import (now also TikTok/Instagram
  and photos of cookbooks), real scaling and unit conversion, cook mode
  with step timers, a plan that feeds an aisle-sorted list, real household
  sharing, offline use, owning your data (export, Paprika import),
  nutrition, fair one-off pricing.

## Issues found

Severity: blocker (stops a Play listing), high, medium, low. Checked in the
code unless marked *(inferred)*.

### Do first (helps everyone)
- [x] **High: the importer fetches any address** (`import.pb.js`), including
  home-network devices, and so does the photo link a page gives it. Refuse
  loopback, private and link-local addresses; cap download sizes.
  Done: 2026-10-31, server/pb_hooks/safe_url.js (written addresses only: PocketBase can't check where a name points or refuse redirects). No download size cap (PocketBase's fetch has none).
- [x] **High: the shopping list doesn't work offline** (only recipes are
  kept on the phone): the usual case in a shop.
  Done: 2026-10-31. Kept on the phone; ticking off and adding work offline and are sent when back online (web/src/offlineShopping.ts). Removing and Clear ticked wait for a connection. The pantry page itself isn't offline yet.
- [x] **Medium: deleting is silent and final.** Deleting a recipe also
  deletes its plan nights, cooked history and ratings without saying so;
  shopping items, "Clear ticked" and plan nights have no undo.
  Done: 2026-10-31. Shopping items, Clear ticked and plan nights show Undo for 6 seconds before really deleting (web/src/undo.tsx); deleting a recipe says what else goes (web/src/deleteWarning.ts). Recipes themselves still can't be undone.
- [x] **Medium: no recipe export** (and no import from other apps).
  Done: 2026-10-31, export only: ⋮ → Export recipes saves every recipe with its photo as a Paprika file (web/src/paprikaExport.ts), read back cleanly the way Mealie and Tandoor read it; not tried in Paprika itself. Android saving (BentoFilesPlugin) compiles but is untried on a phone. Importing from other apps is still to do.

### Google Play
- [ ] **Blocker: the self-updater** (`REQUEST_INSTALL_PACKAGES`). Planned:
  a Play build without it.
- [x] **Blocker: no "Delete my account" in the app** (Play requires one for
  apps that create accounts) *(policy from memory; check in Play Console)*.
  Done: 2026-10-31: Profile → Delete my account (server: the account, picture and ratings; what they added stays). Phone-only: Delete everything erases the phone's Bento.
- [x] **High: privacy policy** doesn't mention phone-only mode, Android's
  own backup (`allowBackup`), or Google's scanner.
  Done: 2026-10-31: site/privacy.html covers phone-only mode, Android backup (now turned off: allowBackup=false), Google's scanner, and in-app account deletion. Goes live when pushed to GitHub.
- [ ] **High: plain http** (`cleartext: true`): passwords travel
  unencrypted on home Wi-Fi; the Data safety form would have to say so.
  Tailscale users are fine. Fix: https via `tailscale serve`, or guide
  friends to Tailscale only.
- [ ] **Medium: 16 KB page-size rule** for native code on Android 15+: check
  the phone-server library *(inferred)*.
- [ ] **Medium: store logos** in the Play build (planned).

### Phone-only mode
- [x] **High: never tried on a real phone**; arm64 only, so older 32-bit
  phones would fail. Hide the option where it can't run.
  Done: Done: 2026-11-01 on a Pixel 7 Pro (Android 17, 4 KB pages): first screen, setup in 1.5 s, importing from links and through the built-in browser (taste.com.au), the home-network refusal, the backup nudge, Save a backup, Restore (a later change was undone), Export (3 recipes and photos, read cleanly), Delete everything, and dark mode. Phones that can't run it go to the server choice (supported(), not tried on such a phone). Not tried: Save my data on a phone whose server won't start (go test covers it).
- [ ] **High: never gets app updates** (its own server has no releases, so
  the check always says "up to date").
- [x] **High: backups only when someone remembers**: no reminder, no "last
  backed up". Set explicit Android backup rules too.
  Done: 2026-10-31: the Recipes page nudges (no backup yet, or two weeks old; Later waits three days), Backups shows when one was last saved. Android's own backup is turned off instead of given rules.
- [x] **Medium: a failed database update on the phone traps the data**
  (Backup needs the server running). Copy the database aside first.
  Done: 2026-10-31: the "couldn't start" screen has Save my data, which copies the data out without the server (Rescue in mobile/bentoserver, tested with go test).
- [x] **Low: the phone account's password is saved only after setup
  succeeds**; if the app is killed in between, nobody knows it.
  Done: 2026-10-31: saved first, put back if setup fails.

### Friends' own servers
- [ ] **High: a stranger can't get a server** without Node/npm; only Xel
  can build the zip. Publish it (GitHub Releases), link the guide.
- [ ] **Medium: a new server can be claimed by whoever reaches it first**
  (`/api/cookbook/setup` before anyone has set it up). A one-time code
  shown in the server window would fix it.
- [ ] **Medium: app and server versions can drift** with no warning.
- [x] **Medium: a wrong or unreachable server address gives no useful
  message** on the login screen.
  Done: 2026-10-31: the login screen says it couldn't reach the address, with what to check.
- [ ] **Medium: no in-app backup or download** in server mode; nightly
  backups sit on the same disk.

### Scale
- [ ] **Medium: the Recipes page loads every recipe in full** and copies it
  all for offline reading; past ~1,000 recipes the offline copy may stop
  saving without telling anyone *(inferred)*.
- [ ] **Medium: the plan, cooked log and pantry load their whole history**
  on many pages.
- [ ] **Medium: recipe photos upload at full size**; HEIC is refused, and a
  too-big imported photo may fail the whole import *(inferred)*.

### Other countries and languages
- [ ] **Medium: English only**, but dates follow the phone's language, so a
  Dutch phone mixes Dutch dates with English text.
- [ ] **Medium: Dutch units**: dl, decimal commas ("1,5 kg") and el/tl
  spoons aren't understood.
- [ ] **Low: the week always starts on Monday** (Americans expect Sunday).

### Missing features (compared with other apps)
- [ ] Scaling servings
- [ ] Timers you tap in the method
- [ ] Import from Paprika and other apps
- [ ] Shopping list grouped by aisle, duplicates combined
- [ ] More than dinner in the plan
- [ ] Print or share a recipe
- [ ] Reset a forgotten password without the admin page

### Small things
- [ ] `added_by` / `cooked_by` can be set to anyone by the app (members
  could fake who added something).
- [ ] Past days on the plan are faded to 55%, likely too faint to read.
- [ ] Labels starting with an emoji are read out as emoji names by screen
  readers *(inferred)*.
- [ ] The friends' start script says "send it to Claude".

## The decision (2026-10-31)

**Phone-only is the default** for outside users (and the Google Play
path); a server is an optional extra for households that want to share,
with a guided setup later. So the order is:
1. Login: phone-only first, "Connect to a server" as the smaller choice;
   phones that can't run it go straight to the server choice.
2. Save the phone account's password before setting it up.
3. "Delete my account" (Play requires it; phone-only erases the phone's
   Bento).
4. Backup reminders and "Last backed up".
5. Never trap data when the phone's server won't start.
6. Privacy policy wording.
7. Then: a real-phone test, the Play build (no updater, no store logos,
   AAB), the 16 KB check; later, the guided server setup.

(The other path, friends running their own servers, needs a published
zip, https, and the importer fix, which is done.)

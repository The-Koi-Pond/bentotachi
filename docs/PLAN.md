# Plan

For a household of three, all on Android. Must work on everyone's phones,
keep recipes readable without internet, and avoid subscriptions.

## How it fits together

- **PocketBase** on the household Raspberry Pi (which also runs the TV ad
  blocker) stores everything and handles logins.
- **The app** is a React web app. Decided 2026-10-30: it ships as a real
  **Android app (APK)**, wrapped with Capacitor, rather than a home-screen web
  app (PWA). The main reason is a built-in browser that can read the recipe
  page you're looking at, which also fixes imports from sites that block
  Bento's server. Until the APK exists, the same app runs in a browser.
- **Tailscale** (free) lets phones reach the Pi away from home without
  exposing it to the internet; the connection itself is encrypted. The app
  talks to the Pi over plain http on purpose (`cleartext: true`, which
  phone-only mode needs too; .claude/rules/android.md says why).
- **Which servers exist** (Xel, 2026-11-10): the household's Pi is the only
  server running; friends and testers use the Google Play version in
  phone-only mode, which carries its own server. So the server is never
  older than the app talking to it (the Pi is deployed first, and a phone's
  own server comes with its app): code for "an older server" in the app
  can go. Code for "an older app" on the server stays while the household's
  Play phones lag behind the Pi.

## Stages

1. **Cookbook** (built)
   - [x] Log in (accounts made by the admin; no public sign-up)
   - [x] Import from a link: reads the recipe data most sites embed, saves a
         copy of the photo
   - [x] Add/edit by hand, photo upload, tags, "our notes", # headings
   - [x] Search by name, tag or ingredient; tap-to-filter tags (also linked
         from each recipe's tags)
   - [x] Cooking view: tick off ingredients and steps, keep screen on
   - [x] Settings menu, Manage mode for deleting, icon buttons in the top bar,
         two cards per row on phones, description preview box
   - [x] Browse tab: common recipe sites and a search-them-all box (opens
         the phone's browser for now)
2. **Shared shopping list** (built)
   - [x] Shopping tab; add anything by typing; tick off; "Clear ticked items"
   - [x] "Add to list" on a recipe: pick ingredients, skips ones already on
         the list, shows which recipe each item is for
   - [x] Live updates for everyone, plus a reload when the app comes back
         to the front (phones pause background apps)
3. **Pantry**, part 1 (built)
   - [x] Items grouped by where they live, with subcategories (dropdowns:
         Fridge/Freezer/Cupboard to start, "+ New…" to add), collapsible
         drawers with count badges
   - [x] Have / Low / Out with one tap; filters for Low, Out and Use soon
   - [x] Out puts it on the shopping list (server rule); Low offers a button
   - [x] Ticking it off on the shopping list sets it back to Have (and clears
         the old expiry date); unticking sets it to Low. A hand-typed item with
         the same name gets linked instead of doubled.
   - [x] Optional expiry dates: "Expires in 3 days" / "Expired yesterday"
   - [x] **Pantry, part 2**: recipe ingredient lines link to pantry items
         (guessed by name, or chosen and remembered per recipe), show
         Have / Low / Out chips, go on the shopping list as the pantry name
         (linked, so buying marks them Have), and "Select what we need".
4. **Android app**
   - [x] Android Studio (Xel already had Panda 2025.3.4)
   - [x] Wrap Bento with Capacitor; the server address is typed in on the
         login screen (the app is no longer served by PocketBase itself)
   - [x] First (debug) APK installed on Xel's phone, reaching the PC through
         Tailscale (home Wi-Fi didn't work: likely the router keeping Wi-Fi
         and cabled devices apart)
   - [x] Signing key made and backed up somewhere safe (a USB stick, with
         its password). Losing it means nobody can update and everyone
         reinstalls.
   - [x] Built-in browser for the Browse tab, with "Save to Bento": sends the
         page's recipe data to the server, which reads the recipe from it
         instead of downloading the page itself (works for sites that block
         Bento). Also offered on Add recipe when an import fails.
   - [x] Self-updating like Mihon (`npm run release`, Update banner,
         "Check for updates" in the ⋮ menu): 1.2 → 1.2.1 worked on Xel's phone.
         Play Protect warns on every sideloaded install; "Install anyway".
   - [x] Offline reading: the phone keeps a text copy of the recipes each
         time they load, and shows it (with an "Offline" note, no photos)
         when the server can't be reached. Forgotten on logout.
   - [x] "Share to Bento": "Save to Bento" in Android's share menu opens
         Add recipe and imports the shared link.
5. **Move to the Pi + Tailscale**:
   - [x] Bento runs on the Pi as a service (2026-10-30), data moved and
         checked, nightly backups, `npm run deploy` and `npm run backup`.
   - [x] Everyone switches their app's server to the Pi's address (done by
         2026-11-10, when every phone in the household was on the Play
         version, connected to the Pi).
   - [ ] `tailscale serve` for an HTTPS address, then an app update that
         turns off `cleartext` (insecure connections).
6. **Public on GitHub** (github.com/The-Koi-Pond/bentotachi):
   - [x] Household details moved to private files (`web/scripts/pi.json`,
         `CLAUDE.local.md`); made-up examples in the code and docs.
   - [x] Website (landing page and privacy policy): since 2026-11-03 the
         `bentotachi/` folder of The Koi Pond's website repository (it was
         this repository's `site/` folder).
   - [x] Created the repository, pushed a fresh history (the old one is
         kept privately), turned on Pages (2026-10-31).
   - [x] Licence: PolyForm Noncommercial 1.0.0 (2026-10-31; briefly MIT
         before that, while nobody had seen or copied it): free to use,
         change and share, but not to sell or make money with.
7. **Phone-only mode** (Bento with no server to set up):
   - [x] PocketBase built into the Android app (mobile/, gomobile; see
         mobile/README.md), running privately on the phone with the same
         hooks and migrations; the login screen offers "Just me, on this
         phone" (just a name) or "Connect to a server". Tested on the PC
         (`go test`); the emulator can't run it.
   - [x] ⋮ → Backups (phone-only): save a backup file, restore one, and the
         login to use once it's restored on a real server.
   - [x] Try it on a real phone ("Bento (test)", `-PbentoTest`): first
         start, adding and importing recipes, closing and reopening, backup
         and restore (Pixel 7 Pro, 2026-11-01 and 11-03; docs/REVIEW.md).
         Taking photos with the camera is still untried.
   - [x] Privacy policy: Android's own backup. Turned off instead
         (`allowBackup="false"`), and the policy says so.
   - [ ] When `cleartext` is turned off, still allow 127.0.0.1 (the phone
         server) in a network security config.
8. **Google Play** (Android only for now):
   - [x] Developer account (US$25 once, ID check; approved 2026-11-03).
         New personal accounts need a closed test with 12+ testers who stay
         opted in for 14 days in a row before going public; when applying,
         Google asks how the test went, so testers should really use it and
         have an easy way to send feedback.

   Before inviting testers (the checklist from 2026-11-03, in order; check
   Play Console's own list, which wins over this one):

   Already done (docs/REVIEW.md, 2026-10-31 and 11-01): Delete my account
   (Profile; phone-only erases everything), Android's own backup turned
   off, the privacy policy's phone-only, scanner and deletion parts, a
   first phone-only run on the Pixel. The 16 KB page-size rule passes
   (checked 2026-11-03: libgojni.so's sections are 16 KB-aligned, and
   zipalign -P 16 accepts the 1.13.0 APK).

   - [x] Phone-only mode on a real phone again (Pixel 7 Pro, 2026-11-03):
         set up in a build from 11-01, added a recipe from a link, shopping
         items and pantry items, then installed today's build over it:
         everything kept, the new migrations ran. Then 1.13.0's pantry
         (Simple/Detailed, the level dropdown, "Put it on the shopping
         list?", a typed barcode found at Open Food Facts with its photo,
         Google's scanner opening and closing), saving a backup, and
         restoring it. Fixed on the way: Woolworths' "Image coming soon"
         picture saved as a product photo; closing the scanner with Back
         showing "The scanner isn't ready yet"; Open Food Facts' "400 g e".
   - [ ] Still needs Xel's hands: scanning a real product with the camera,
         and taking a photo of an item with the camera.
   - [x] Google's account-deletion rule also asks for a web page or link
         where people can ask for deletion without the app (2026-11-05):
         thekoipond.dev/bentotachi/delete-account.html, linked from the
         privacy policy and the Bentotachi page's footer. It's the link for
         the Data safety form.
   - [x] Phone-only mode hides account details (decided and built
         2026-11-03, tried on the Pixel; "To design: simpler accounts"):
         Profile shows no username or password, and Backups keeps the
         login behind "Here's your login" for moving to a server.
   - [x] Privacy policy: add pantry item photos (looked up at Open Food
         Facts by barcode, or from a store page you linked), done
         2026-11-05 with fridge-door notes, packets and "Take a photo" (the
         phone's camera app; no camera permission). Then the data safety
         form to match (Xel, in Play Console).
   - [x] Fix the known bugs a lone phone user would meet (2026-11-03):
         swapping two meals is one request that saves both or neither
         (pb_hooks/meal_plan.pb.js); a recipe saved in Bentotachi's browser
         after Android closed the app in the background is imported when
         it starts again (bentoBrowser.ts RestoredSaveReceiver). The backup
         pickers' version of that is smaller and left in TODO.md.
   - [x] A first-time look through recipes, the plan and settings, the way
         the pantry got one: first start, empty screens, wording (2026-11-05,
         a new household on a throwaway server at phone width; see
         docs/RELEASES.md, 1.17.0).
   - [x] Store listing: 512 px icon, 1024 × 500 banner, 2 to 8 phone
         screenshots without store logos, short and long description,
         content rating questionnaire, target audience (2026-11-06: text
         and answers in docs/PLAY-LISTING.md, pictures in branding/play/
         from branding/make_play_listing.py; entering them in Play Console
         is Xel's, below).
   - [x] 12+ testers lined up, and a way for them to send feedback (the
         closed test opened 2026-11-08 with 14 testers: the signup and
         testers' pages on the website, and its feedback form).

   Not needed before testing: new features (Packets in stock), iPhone.

   - [x] A Play build without the self-updater (built 2026-11-03: `npm run
         play`, see CLAUDE.md): no "new version" banner or APK downloads,
         no `REQUEST_INSTALL_PACKAGES` (Play only allows it for app
         stores), and no "Support Bentotachi ♡" (Ko-fi) link: Google pulls
         apps over donation links (docs/VISION.md). Checked: the bundle
         has no such permission and is signed with Bento's key; a test
         copy on the Pixel had no updater plugin, banner or Ko-fi link.
   - [ ] Store logos stay in the app (decided 2026-11-01): small icons that
         label a link to that store are normal, and the Household page says
         they belong to their owners and Bentotachi isn't connected with any
         store. Keep them out of the Play listing, screenshots and icon
         (Play's impersonation rules are about implying a connection). If a
         store or Google ever objects, swap them for coloured letter badges
         in StoreLogo.tsx.
   - [x] App bundle (.aab): `npm run play` makes it (2026-11-03).
   - [x] In Play Console (Xel): Play App Signing with Bento's key as the
         upload key, store listing, data safety form (answers drafted in
         docs/PLAY-DATA-SAFETY.md, 2026-11-06), privacy policy link
         (thekoipond.dev/bentotachi/privacy.html). Done by the closed
         test's start (2026-11-08); new store screenshots still to swap in
         (Xel's to-do list).
   - [x] Play-signed builds can't update self-installed ones: everyone
         reinstalls once (recipes are safe on the server). Done: since
         2026-11-10 every phone in the household runs the Play version.
   - [ ] Production access: after the closed test's 14 days, apply in Play
         Console, with the testers' feedback (saved by the testers' page)
         as the evidence Google asks for.

## Waiting for the next app release

Changes already live in the browser version, not yet in a published APK
(they go into the next `npm run release`'s notes). When a release goes
out, its list moves to the top of docs/RELEASES.md as "Released in …".

Not released yet:

- Counted things in the pantry: a packet's size can be a count ("12
  eggs", "dozen", "6 pcs", or "1" for a loose onion), so "3 eggs" comes
  off a carton of 12 after cooking ("about 9 left") and the shopping list
  knows 2 cartons are enough. A packet with no size is still never
  guessed at.
- From a tester's second report: the tab bar's labels stay inside their
  tabs at the largest phone text ("Shopp…"); an export says the name
  Android really saved it as ("… (1).paprikarecipes"); adding a site
  that's already on the list says so; restoring a file that isn't a
  backup says so plainly, without the raw zip error.
- Dark in the app now darkens Android's own bars too: their icons on every
  Android, and their colour on Android 14 and older (it left light strips
  above and below; BentoBarsPlugin.java, SystemBarColours.tsx).
- Opening a recipe with no signal, its heart and ratings come back once
  the connection does; a photo that can't show offline takes its button
  and gallery dot with it; Import & export recognises a Bentotachi backup
  and says to restore it from Backups. A heart tapped just as the
  connection comes back stays put, and "Backup saved" waits until the
  file is really written.
- Browse: BBC Food's Categories button is back, its categories' recipes
  now read (cards that are links around a heading; recipe_parse.js
  `recipeLinks`).

Earlier releases, newest first: docs/RELEASES.md.

## Next up: the pantry listings (Xel, 2026-11-02)

Xel wants to keep working on how pantry items look and what they hold.
More may come; these are the ones so far:

- [x] The row's layout and card composition as a whole (2026-11-02; see
      docs/RELEASES.md).
- [x] Several store links per item (2026-11-02; see docs/RELEASES.md).
- [x] The brand kept next to the product name (2026-11-02: small, under
      it). Becomes the favourite brand with "Packets in stock" below.
- [x] A better place for expiry warnings (2026-11-02: a badge beside the
      name).
- [x] Packets in stock (designed 2026-11-02, built 2026-11-05; see
      docs/RELEASES.md). On the row as
      chips, "In stock: White Mill 1 kg ✕ · Coles 2 kg ✕"; tapping one
      finishes it (Xel's pick in the playground).
- [x] A more compact Have / Low / Out (2026-11-02: a level that opens a
      dropdown).

### Packets in stock (Xel, 2026-11-02; built 2026-11-05)

What it's for: knowing what's actually in the cupboard, for households who
want that. It never pushes stock-taking (VISION.md, 2026-11-02): an item
with no packets works exactly as today, and nothing asks anyone to add
any.

- The item is the thing ("Plain flour"): name, place, photo, Have / Low /
  Out, store links (where to buy it), and a **favourite brand** (one brand
  to look for when shopping), replacing "Brands we buy". A replacement
  brand bought when the favourite was gone isn't a brand setting: it's
  just a packet.
- **Packets:** one entry per bag, jar or can actually there, with its brand
  and size ("Coles, 2 kg"), and the barcode it was scanned from, if any.
  Each is its own record (a new collection linked to the item), so two
  phones finishing different packets at once don't undo each other.
- Out of the way: the row shows "In stock: White Mill 1 kg, Coles 2 kg"
  only when an item has packets; "+ Add a packet" lives in the opened card
  or the form; scanning something already in the pantry *offers* "Add this
  packet" beside the usual Low / Out / Edit, rather than adding one by
  itself. Brand and size come from Open Food Facts the first time (it
  already sends the size, which is thrown away today), and the item
  remembers them for that barcode.
- **Finished** on a packet removes it. Low stays a judgement ("half a bag
  left"), never a count. Tapping Out on an item with packets clears them,
  with Undo, so a count that's drifted is quick to fix.
- Later, as its own step: opened and expiry dates per packet (the opened
  bag in the fridge, the spare in the cupboard), moving today's per-item
  expiry and Opened button.

Decided (Xel, 2026-11-02):

1. Finishing the last packet turns the item Out by itself. Whether it then
   goes on the shopping list should be the person's choice: they may not
   want to buy it again for a while, but knowing it's out while at the
   store is handy. Xel picked asking first ("Put it on the shopping
   list?"), for tapping Out too; built 2026-11-02. Idea still open: the
   shopping list shows "Out at home, not on the list" in a small closed
   section, so it's still seen at the store.
2. The favourite brand is picked by the person, never guessed. (Built
   2026-11-05: items with one brand keep it as the favourite, since someone
   typed it; items with several show them in the form as buttons to pick
   one, and stay as they are until someone does.)

### A more compact Have / Low / Out (Xel, 2026-11-02)

Done 2026-11-02: the three buttons took a lot of the row, so it's now a
level meter (three bars and the word) that opens a dropdown. Picked in a
pantry card playground along with the rest of the row's layout.
- [x] Open Food Facts as the first place a photo comes from (2026-11-02;
      see docs/RELEASES.md). Next: a `review-for-xel`
      of the photo code (the pantry photos haven't been reviewed yet).

## To design: simpler accounts (Xel, 2026-11-02)

Xel's idea: someone using Bentotachi alone shouldn't need an account, and
definitely not a password; accounts should belong to the server setup, with
clear steps for making one per household member. Needs careful thought
before any code: Xel wants it explained step by step first (plain words,
with what each choice means for them), then decides.

Where things stand, as a starting point:

- Every list is locked to logged-in people (each collection's rules), and
  ratings, "added by", "cooked by" and colours belong to a person. So the
  database needs a person behind every change, even for one user.
- Phone-only mode already makes the account by itself (a username from the
  name, a random password) and logs in by itself (web/src/phoneMode.ts).
  What's left to see: Profile's username and password boxes, the password
  on the Backups page, and the login screen if something goes wrong.
- A server (the Pi, a friend's PC) is reachable by anyone on the Wi-Fi or
  Tailscale, so it needs a password even for one person.
- The hidden account is also what lets a phone's backup move onto a
  household server later, keeping everyone's ratings and names.

Suggestion so far (Claude, not decided): in phone-only mode, hide account
details entirely, except a "Moving to a server? Here's your login" note on
Backups; on servers, keep accounts and improve the setup guide's steps for
adding each person (Settings > Household > Add someone). Questions to settle
with Xel: what single-user mode on a server should look like; whether the
first-run screen should ask "just me" vs "a household" before anything
about accounts; and how this fits the still-open forgotten-password choice.

**Decided (Xel, 2026-11-03):**

- **Phone-only mode hides account details completely:** no username or
  password on Profile, Backups or anywhere else, except a "Moving to a
  server? Here's your login" note on Backups. Built the same day: Profile
  hides the Username box and the Password section in phone-only mode,
  and Backups folds the login away until "Here's your login" is tapped.
- **Forgotten passwords:** anyone in the household can set a new password
  for anyone else, from Household. Today only the server's admin page
  (/_/) can, which nobody in the household uses.

Still to settle with Xel: what single-user mode on a server should look
like, and whether the first-run screen should ask "just me" vs "a
household" before anything about accounts.

## To consider: online shopping from the list (Xel, 2026-11-03)

Seen on Reddit: ListRunner (iOS) takes a Paprika shopping list, opens a
store's website inside the app, and each time something goes in the cart
it fills the store's search box with the next item. The person still picks
the brand, size and how many; it only saves typing 20 to 30 searches. Its
limits: a separate app, iOS only, Paprika only. Bentotachi already has
most of the pieces, for anyone using it.

Pieces we already have:

- The built-in browser (BrowserActivity), whose bottom button changes per
  job (Save to Bentotachi, Link this item, Add to pantry). A shopping run
  would be one more job.
- Each country's stores and their search addresses (web/src/stores.ts).
- Store links on pantry items: a linked item can open its exact product
  page instead of a search.
- Brands on pantry items (the favourite brand, since 2026-11-05), to add
  to the search ("Lea & Perrins worcestershire sauce").

Rough shape (Claude's suggestion, not decided):

- Shopping list → "Shop online" with the store's logo (Android app only).
- Bento's browser opens on the first unticked item: its saved product page
  at that store if there is one, otherwise the store's search for its name
  and brand. A bar at the bottom: "3 of 24 · Garlic", Back, Skip, Next.
- Next goes to the next item by opening the store's search page for it,
  rather than typing into the store's search box: works the same on every
  store and doesn't break when a store redesigns its site.
- "In the cart" isn't "bought" (ticking off sets the pantry back to Have,
  and delivery can be days away). So the run only remembers what you got
  to; at the end it asks "22 in the cart. Tick them off now, or later?"
  Skipped items stay unticked.
- A "Link this item" button in the bar: the product you picked becomes the
  item's store link, so the next run goes straight to it.

Worth knowing before deciding:

- Moving on by itself when something goes in the cart (like ListRunner)
  means recognising each store's "Add to cart" separately, and it breaks
  whenever a store changes its site. Suggest the Next button first, and
  auto-advance later (Coles and Woolworths only) if Next feels slow.
- Logging into the store happens inside Bento's browser, which remembers
  it like any browser. During a run Bentotachi only changes the page's
  address and never reads the store's pages; the privacy policy should say
  so. Store carts usually belong to the account, so checking out in the
  store's own app should work too (to check per store).
- The browser version on a PC can't steer another site's tab. A small
  version works everywhere, though: a store icon on each shopping item
  that opens that store's search for it in a new tab. Cheap, and could
  come first.

**Decided (Xel, 2026-11-03):** the full shopping run inside the app's
browser, with Next and Skip (the rough shape above), rather than the small
store-icon version first. Not scheduled yet; the Google Play work comes
first.

Answered (Xel, 2026-11-03):

1. How often the household shops online: not often, usually at Coles. Xel
   can test with a dummy run that stops before checking out. So: Coles
   first, and no hurry.
2. One store per run, picked at the start.

Still open: the small store-icon version on PCs too, or just the app?

## To consider: an optional AI helper (Xel, 2026-11-03)

The idea: an AI assistant inside the app, off unless someone switches it
on, using a model the person chooses (or the phone's own). Obvious uses:
changing a recipe, ingredient swaps, planning the week's dinners; more to
find. And the reverse: talking to the phone's own assistant (Gemini) from
outside the app and having it change things in Bentotachi (opt in).

How it fits the promises (VISION.md): Bentotachi never pays for or charges
for AI; a cloud model is the person's own account and bill. On-device and
home-computer models keep everything private. A cloud model means that
company sees what's sent, so the settings must say plainly what goes where
("When you ask, your recipes and pantry are sent to OpenAI"), and VISION.md
would need a line about it. Xel still never sees anything.

Where the AI could run (one setting, three kinds):

1. **The phone's own model** (Gemini Nano, through Google's ML Kit Prompt
   API): free, private, works offline. Only some phones: in 2026 the Pixel
   10s, Galaxy S26s and a few others. The Pixel 9 seemed listed only for
   Google's fixed summarise/rewrite tools, not open questions (check
   Google's live list before relying on it). A small model: fine for
   "what can replace buttermilk?", weak at planning a week from 100 recipes.
2. **A model on the household's own computer** (Ollama, LM Studio):
   private and free, but needs a decent PC left on. The Pi is too slow.
3. **A cloud service with the person's own key**: most speak the same
   "OpenAI-compatible" language, so one setting (address, key, model name)
   covers OpenAI, OpenRouter (which reaches Claude, Gemini and many more)
   and the home-computer ones above. The strongest for planning.

Rough shape (Claude's suggestion, not decided):

- Started from where you are, so it already knows what you mean: "Ask
  about this recipe" on a recipe, "Help me plan" in the dinner chooser,
  and a general chat from the ⋮ menu.
- The AI gets tools to look things up (search recipes, read one, the
  pantry, the plan) and to *suggest* changes. It never changes anything by
  itself: a suggestion shows as a card ("Plan: Tue Curry, Wed Tacos", or
  the recipe with its changes marked) with Apply / Not this. Apply uses the
  same code as doing it by hand, so pantry rules, "added by" and Undo all
  still work.
- Keys stay on each person's phone (nobody spends someone else's money).
  The phone's own model needs a new native plugin, like the scanner's.
- Start small: one kind first (suggested: the OpenAI-compatible setting,
  since it covers the most), answers only (swaps, recipe questions), then
  suggestions that change things.

The reverse (the phone's assistant using Bentotachi):

- Android's **AppFunctions** (Android 16 and newer): an app lists actions
  ("add milk to the shopping list", "what's for dinner tonight?", "plan
  tacos on Friday") and Gemini can call them on the phone. In 2026 it's an
  experimental preview, and Gemini only calls apps in Google's test
  programme so far; whether it would call a sideloaded app is unclear. The
  actions would be a small native layer over the server routes we already
  have, with a switch in Settings. Worth waiting until it's open to all.
- Already works today, with no AI work: Android's share menu brings links
  into Bentotachi. Shared plain text could go onto the shopping list.
- Desktop assistants (Claude, ChatGPT) can use apps through "MCP". But
  their apps call from the company's servers, which can't reach a Pi
  that's only on Tailscale; only assistants running on a home computer
  could. Not worth it for now.

Worth knowing before deciding:

- VISION.md's "What it won't become" has "An AI recipe writer or meal
  'suggester'" (marked as a guess). An opt-in helper that only suggests is
  different, but Xel should settle that line either way.
- It's a big feature: three kinds of model to test, and chat screens.
- Google Play requires apps that generate AI content to have an in-app way
  to report an offensive answer to the developer. It would need a "Report
  this answer" that reaches Xel without a company server (an email or a
  GitHub issue, to check). Not needed for the sideloaded app.
- Food safety: AI answers can be wrong about allergies, undercooked meat
  or preserving. Keep a plain short note on answers, and never treat an
  AI swap as safe for an allergy.
- Teenagers in a household (Xel, 2026-11-07): keep the helper to adults
  without asking anyone's age. Off by default; whoever runs the household
  server switches it on per person (parents leave it off for their
  kids); and it needs a person's own AI key, which providers only give
  adults (or teens with a parent's consent). Google Play's newer age
  signals for apps are worth checking then, but aren't needed for this.
  The Play listing's target audience is 18+ for now; it doesn't stop
  teens installing, and 13+ is an option later (the privacy policy's
  "not made for children" would then say "under 13").

**Decided (Xel, 2026-11-03): not now.** The Google Play work comes first;
the questions below wait until this comes back.

Questions for Xel:

1. (Answered: Xel's phone is a Pixel 7 Pro, which can't run the phone's
   own model, so that kind can't be tried here without another phone.)
2. Which kind first: your own key, a home computer, or the phone's model?
3. Answers only to start, or suggestions that change things from the
   start?
4. Is talking to Gemini from outside a must, or a bonus for once Google
   opens it up?

## To consider: more personality in the app (Xel, 2026-11-03)

Xel wants Bentotachi to feel less generic, with personal touches, while
staying clear where it matters. The example: an export screen where you
tick what to save, shaped like a bento box, Recipes as the big
compartment. Needs mockups (a playground) before deciding anything.

The rule that keeps it clear (from VISION.md's voice, applied to shapes):
**the shape can be playful, the words and the control stay plain.** A
bento compartment is still obviously a checkbox (a tick, a filled or empty
state, its plain label "Recipes"), a screen reader hears "Recipes,
checkbox, ticked", and it works in light and dark. Buttons and warnings
keep saying what they do. Animations stay short and stop when the phone's
"remove animations" setting is on. One playful thing per screen at most,
so it stays special.

Ideas, roughly cheapest first (Claude's, for Xel to pick from):

- **A voice pass.** VISION.md says the app's text is plain so far and asks
  how cheeky it should get. List every empty screen, hint and success
  message with a plain-plus-cheeky version beside it, and Xel picks. No
  design work, and probably the biggest change in feel.
- **More of Ben's moods** where he'd help: the offline note, a fully
  ticked shopping list, a finished timer. Built from his SVG like the
  others; one or two details each.
- **A hanko stamp for "We cooked this"**: a little round seal with the date
  on the recipe page instead of a plain line, and the history as a row of
  stamps. Ties into "Last had".
- **Chopsticks as the loading sign**, picking up a grain of rice, instead
  of a plain spinner.
- **The bento picker** (Xel's idea) for the export screen. Worth knowing:
  today, ⋮ → Import & export saves recipes only (a Paprika file), and
  phone-only Backups save everything in one file. Picking parts suits
  *export* (taking things elsewhere: recipes, plan, shopping list, pantry
  as separate files) better than *backups*, where leaving something out
  could lose it on restore. So: the bento for export, backups stay
  "everything", plain. Needs export formats for the plan, list and pantry
  first (they don't exist yet).
- **A baran divider** (the zigzag green leaf from bento boxes) between big
  sections, in jade, instead of plain lines. Check it against VISION's
  "each detail once" (the title's leaf has baran ridges).
- **The week as a bento** on the plan: a box with one compartment per
  night, as a summary at the top. Riskier for clarity than the others;
  try it in a mockup before believing in it.
- Small, seasonal, rare: Ben in a scarf in winter and the like. Easy to
  overdo; only if the moods system makes it cheap.

More ideas (2026-11-09, after the Compact pass; screenshots showed what
reads generic now: 🍲 emoji as every photo-less recipe, signal bars for
Have / Low / Out, the same tinted-header card everywhere, iPhone-style
pill switches, a plain strike-through):

- **Pond Pebbles for our own section headings** ("Ingredients", "Method",
  "Got it", shelf names), not just page titles. Nearly free. It has no
  accented letters: names people type need the phone's font as a fallback.
- **Drawn stand-ins for recipes without a photo**: a small bento or onigiri
  tile with the recipe's first letter, coloured by its shelf, instead of 🍲
  on pink (emoji as icons is one of the AI-made tells).
- **Pantry levels as a rice jar or bowl** (full, half, nearly empty)
  instead of phone-signal bars: food, and still readable at a glance;
  keep the Have / Low / Out words and colours.
- **A brush stroke through ticked shopping items** instead of a plain line,
  and Ben cheering when the whole list is ticked.
- **Method step numbers in small onigiri**, matching the onigiri ratings.
- **Switches as a bento lid**: Simple | Detailed as two compartments with a
  baran zigzag between, instead of the iPhone-style pill.

Claude's suggested set, one per screen: Pond Pebbles headings, drawn
stand-ins (Recipes), the hanko stamp (a recipe), rice-jar levels (Pantry),
the brush stroke (Shopping).

Built 2026-11-09 (Xel's picks from mock-ups on the real screens; VISION.md
"Bento touches"): Pond Pebbles headings, the bento-box stand-in (over the
onigiri one), jar levels, the brush stroke, the "Cooked" stamp, and Xel's
own switch design (a wooden chopstick under the chosen option, the other
faded) instead of the bento lid. Still open from this list: the voice pass
(a picker page of 56 lines is ready for Xel), onigiri step numbers, Ben
cheering at a fully ticked list, the chopsticks loader, the bento export
picker, the week as a bento, seasonal Ben.

Next step when Xel wants it: a playground with two or three versions of
the bento export picker (and maybe the hanko stamp), light and dark, at
phone width; and the voice-pass list as its own short document.

## Surprise me, gacha style (Xel, 2026-11-09; built the same day)

The plan's "🎲 Surprise me" says something above the recipe it picks, and
gets cheekier the more times in a row it's asked (web/src/surpriseLines.ts,
lines from Xel's own brainstorm):

- First roll: "The dice have spoken." Rolls 2–3: everyday lines ("How
  about this one?", "Behold, dinner."). Rolls 4–6: half cheeky ("Tough
  crowd.", "Picky, picky."). From roll 7: mostly cheeky.
- Rare gems, 1 in 20 from roll 2 ("The Council of Dinner has reached a
  decision."); "Ben is beginning to take this personally." only from roll
  8, so it lands when the app has otherwise been minding its business.
- Never the same line twice in a row; no escalation when only one recipe
  can be offered (asking again isn't being picky then); it starts over
  each time the chooser opens. The recipe always shows with the line, and
  "Nothing matches" stays plain.

## To consider: talking to Bentotachi while cooking (Xel, 2026-11-07)

Hands covered in flour, phone propped on the counter: "Hey, what does
step 3 say again?" and Bentotachi reads it out loud. Also "next step",
"start the timer", "how much garlic?".

There are two ways in, and only one works today:

1. **Inside the app, while a recipe is open (works now, no Google
   permission needed).** Android has speech recognition and text-to-speech
   built in, for any app. A "Cook out loud" button on the recipe page
   starts listening; Bentotachi understands a small fixed set of phrases
   and answers by voice:
   - "Step 3" / "read step 3" / "what's step 3?", "next", "back", "again"
     (repeat the last thing read).
   - "How much garlic?" (finds the ingredient line, scaled to the chosen
     servings).
   - "Start the timer" (the current step's timer: step timers already
     exist, `stepTimers.ts` and `StepTimerTray.tsx`), "how long left?".
   - "Stop" / "I'm done" (stops listening).
   This needs no AI: matching a handful of phrases is ordinary code, and
   the step and ingredient text already exist. It's a new native plugin
   (like the scanner's) or a community Capacitor plugin for speech
   recognition and text-to-speech. The WebView can't do it alone: Android's
   WebView doesn't support the browser's speech recognition.
2. **"Hey Google, ask Bentotachi…" from anywhere (not yet).** That's the
   phone's assistant calling into the app. On Android it now means Gemini
   (it replaced Google Assistant on phones in September 2026), and the
   way in is **AppFunctions**: still an experimental preview, with Gemini
   only calling apps in Google's test programme (see "The reverse" in the
   AI helper section above; one native layer would serve both). Revisit
   when Google opens it to all apps.

Worth knowing before deciding:

- **Listening all the time is the hard part.** Android's recognizer
  listens for one phrase and stops; it isn't made for a wake word ("Hey
  Bento"), and keeping it running drains the battery and shows the
  microphone indicator. Realistic options: listen only while "Cook out
  loud" is on and the recipe is open, restarting after each phrase, with
  the screen kept awake; or one big tap-to-talk button (a knuckle or elbow
  works with floury hands). A real wake word needs an extra engine
  (Picovoice is commercial; openWakeWord is open source but would need
  bundling); not worth it for a first version.
- **Offline:** Android 12 and newer can recognize speech on the phone
  itself (no internet), where the phone has the language downloaded. Use
  that when available, so recipes aren't sent to Google's servers, and say
  so in the privacy policy (thekoipond.dev/bentotachi/privacy.html) either
  way, since the microphone is new data handling.
- **Permission:** it needs the microphone permission (`RECORD_AUDIO`),
  asked the first time "Cook out loud" is used, with a plain reason. Google
  Play's Data safety form would need updating ("audio, processed on the
  device, not collected").
- **Kitchen noise:** extractor fans and sizzling pans hurt recognition.
  Keep the phrases short and forgiving ("three", "step three", "third
  step"), and always show what it heard on screen.
- **Reading aloud on its own** (no listening) is the easy half and useful
  by itself: a speaker button on each step, or "read the steps one by
  one" with a tap for next. A good first slice.
- **Languages:** the phrases would start in English; other languages need
  their own phrase lists.

Suggested order: (1) a speaker button that reads a step out loud; (2)
"Cook out loud" with the fixed phrases, on-device where possible; (3)
Gemini through AppFunctions once Google allows it.

Xel's answers (2026-11-07):

1. Tap-to-talk (one big button) first; hands-free listening later.
2. The phone's own voice is fine (no Ben voice).

## Buy only what the pantry is short of (Xel, 2026-11-08; built the same day)

Adding a recipe's ingredients to the shopping list should count what's in
stock. Example: the pantry has 200 g of linguine, the recipe (scaled up)
needs 1.5 kg, so the list gets "1.3 kg linguine", not 1.5 kg. Needs the
pantry's packets to say how much is left (pantry_packets has sizes like
"500 g"; see pantryPackets.ts), the recipe line's amount at its scale
(scaling.ts reads amounts), and units that can be compared (g/kg, ml/l;
"2 onions" against a packet count is harder). Where it can't tell, add the
whole amount as now. Xel: build it next time.
Xel's choices (2026-11-08): every packet in stock counts as its full size
(packets don't say how much is left; now and then the list asks for a bit
too little, which beats another thing to keep up to date). A line the
pantry already covers stays in the add choices, unticked, saying "Enough"
and what's in stock; a short one shows the reduced amount and "Have …".
Built (pantryStock.ts): the recipe page's "Missing from pantry" and
Choose…, the list's "From a recipe" and the plan's "Add these to the
shopping list" all use it. Grams, kilos, pounds, ounces, millilitres,
litres, spoons and cups (at the recipe's own spoon size) compare; counts
("2 onions") and packets with no size fall back to Have / Low / Out. An
item two recipes need is compared against both amounts together, but its
row still says just the pantry's name, with no reduced amount.
Xel's choices after the review (2026-11-08): an item marked Low still
counts as worth buying even when its packets look like enough (one may be
nearly empty); the note says so. "All" on the recipe page adds the
recipe's full amounts; "Missing from pantry" and Choose… take stock off.

## Next: pantry polish, and kinds of one thing (Xel, 2026-11-08)

Status (2026-11-10): 1 to 3 are built (ticking adds one; the quick card;
counters, now labels with their own dates in 1.23.0, see "Pantry labels"
in VISION.md); 4 and 5 are still open.

Xel: the pantry is promising but clunky. Agreed after going through it
on a phone-sized screen (2026-11-08), most important first:

1. Packets drift: ticking something bought on the shopping list marks the
   item Have (pantry.pb.js) but adds no packet, so counts go stale and
   "buy only what's short" gets worse. Idea: ticking adds a packet in the
   item's usual size, with Undo.
2. Adding or using up a packet is buried at the bottom of the full edit
   form, which opens on any tap. Idea: a light item card with quick
   buttons (+1 packet, used one, Low, Out) and Edit for the rest.
3. Packet chips: ✕ reads as delete but means "used it up"; identical
   packets repeat ("400 g ✕ 400 g ✕ 400 g ✕"); the brand shows twice.
   Idea: "3 × 400 g" with a "used one" step.
4. Have / Low / Out and packets can disagree (Have with 200 g, Low with
   2 kg); Low stays a judgement, but the row could hint at a clash.
5. Smaller: letter squares take width without a photo ("Chicken thi…");
   the dashed cart icon and "3 to check" don't explain themselves; Simple
   hides packets entirely.

**Kinds of one thing** (pasta, rice, flour, cheese, noodles, vinegar):
a recipe asking for linguine mustn't count as covered because some other
pasta is in. Today a line is matched to the pantry item with the longest
name in it, so "linguine pasta" matches an item called "Pasta". Xel's
pick (2026-11-08): **each kind is its own item** (Linguine, Penne,
Spaghetti, each with its own Have / Low / Out, packets and photo),
**grouped under the umbrella** ("Pasta"). A line naming a kind matches
only that kind, and says "not in the pantry" when there's none; a line
that only says "pasta" (or one marked "any pasta will do") takes any kind
in the group. Chosen over one "Pasta" item with kinds on its packets,
which would leave Have / Low / Out covering all pasta at once. To design
next: the group itself (the subcategory, or its own "kind of" field), how
an existing umbrella item like "Pasta" gets split, and the recipe link
sheet's "any kind will do". Mock up before building. Xel (2026-11-08) is
fine with "a kind of Pasta" as its own small field, not the sub-headings,
"we'll see how it goes".

**Using things up when a meal is cooked** (Xel, 2026-11-08): pressing "We
cooked this" should take from the pantry what makes sense, so it needs
less managing by hand. Xel, later the same day: rather a **Finished**
button at the end of the method, which marks it cooked and then asks
(the moment you know what you used). Open: what the top "We cooked this"
does then (keep it with the same sheet, keep it as a plain record, or
remove it); the cooking timer's finish already counts as cooked too. Open, for the mock-up: packets count as full and
don't record what's left (decided earlier, as tracking it by hand was
too much work), so a recipe using 400 g of a 500 g bag either finishes
the bag (wrong: 100 g is left) or leaves it (wrong next time: counted as
500 g). Cooking could record what's left by itself ("about 100 g left"),
which reverses that decision without asking anyone to count. Also: ask
first ("Used up: 1 bag of linguine, 2 of 3 eggs. Change?") or just do it
with Undo; and what happens to items without packets (maybe Have -> Low
when a recipe uses most of it? probably nothing).

**Xel's picks from the pantry mock-up (2026-11-08):**
1. Kinds of one thing: "Pasta" is a small sub-heading (like Baking), its
   kinds ordinary rows under it.
2. Packets in stock: a counter per size, "− 3 × 400 g +" (Xel's pick over
   "3 × 400 g · Used one"). − uses one up, with Undo, since − and + are
   easy to tap by accident; + adds one more like it.
3. Tapping an item opens a light card under the row: + 1 packet, Used
   one, It's low, It's out, and "Edit everything" for today's full form.
4. Linking a recipe line: "Linguine only" or "Any pasta will do" at the
   top of the sheet, then "Or a different item:" and the list.
5. A **Finished** button at the end of the method marks it cooked, then
   asks "Used anything up?" with what it worked out already ticked; ticked
   ones come off the pantry (Skip to leave it).
5b. A partly used packet says "about 100 g left" in words. (So cooking
   records what's left of a packet, by itself: nobody counts by hand.)
5c. "We cooked this" stays up top (for marking it afterwards) and opens
   the same sheet; so does finishing the cooking timer.

Built 2026-11-08: 2 and 3 (PacketCounters.tsx, PantryCard.tsx), in the
row, the card and the edit form. The card also says what's in stock, as
the Simple layout's row doesn't. Then 1 and 4: kind_of on pantry items
("A kind of", with a "?" saying what it's for), kinds under their group's
name in the pantry, links to "kind:Pasta" for any kind (pantryLinks.ts),
and "Linguine only" / "Any pasta will do" plus "Any pasta" in the link
sheet's list. A line names "any" only when nothing but an amount or a
describing word ("dried", "short") comes before the group's name, so
"bucatini pasta" isn't taken as any pasta. Not built: splitting an old
umbrella item ("Pasta") into kinds; renaming it to one kind and setting
"A kind of" does it by hand. Then 5 (2026-11-08): "✓ Finished" at the end
of the method marks it cooked and opens "Nice. Used anything up?"
(UsedUpSheet.tsx; "We cooked this" and the timer's finish open it too). It
works out (cookedUses.ts, at the size it was cooked): whole packets used
up, a partly used one first, then oldest; the last one used in part keeps
"about 100 g left" (pantry_packets.left, shown on its counter as "500 g,
about 100 g left", and counted as what's left); "1 tin chickpeas" uses one
packet; using the last packet marks the item Out (not put on the list).
An item with no packets is offered as "mark it Low?", unticked. Left out:
"any pasta" lines (which kind is unknown) and anything it can't measure.
The sheet only opens when there's something to offer.
Xel's choices after the review (2026-11-08): the sheet opens only when
something with packets was used ("mark it Low?" lines then ride along for
the rest), so households that don't count packets never see it. Cooked
again the same day (Finished twice, or the timer's too): it opens with
nothing ticked, saying "Already marked cooked today: tick anything used
again." Taking off never marks an item Out if a packet has appeared on it
since the sheet opened (a housemate's purchase).

**Ticking bought things adds a packet** (agreed and built 2026-11-08):
only for items that already use packets, in the size and brand of the
last packet added (the item's usual_packet, kept after its packets are
gone); unticking takes it back off. On the server (pantry.pb.js), so it
works from any phone and from older apps; one packet per tick ("2 tins"
on the list still adds one). Tried on a copy of the Pi's data: the 11
items with sized packets got the right usual packet.
After the review (2026-11-08): unticking takes the packet back only for an
hour after the tick (an old "Got it" row put back on the list leaves the
bag that's really there). Xel's pick: adding a packet by hand (scanning,
"+ 1 packet", a counter's +) within a few hours of a tick having added
one to that item asks first: "The shopping list already added a White
Mill 1 kg an hour ago." That's the one / Add another.

## Next: counted things in the pantry (Xel, 2026-11-12)

A carton of eggs is 12 eggs, and "3 eggs" in a recipe should come off it.
Today a packet's size is read only as a weight or a volume ("500 g",
"1 L"; pantryStock.ts quantityOf), so counts never come off, and a packet
with no size ("+ 1 more") could be one egg or a whole carton, so cooking
skips it rather than guess. This also settles the "1 onion" question
(a tester's report, 2026-11-12): instead of guessing at sizeless packets,
sizes learn to be counts. Decided (Xel, 2026-11-12):

- A size can be a count: "12 eggs", "dozen", "6 pcs", "12". A carton is
  12 eggs; two cartons are 24, like two bags of flour.
- Cooking takes counts off: "3 eggs" against a 12-egg carton leaves "9
  left" (the packet's `left`, as "200 g" leaves "300 g" today). A count only
  matches its own item (a bare number before the item's name, "2 onions"),
  never a carton size on something else; "1 egg yolk" or "half an onion"
  stay skipped, like anything it can't measure.
- A barcode scan fills the count in when the product database says one
  ("12", "12 pcs"); when it gives a weight instead, you set it once and the
  item keeps it as its usual size.
- Loose things: an item whose usual size is "1" (an onion) counts one per
  "+ 1 more", so "1 onion" comes off.
- No size stays unknown, never guessed: the "3 eggs uses up three cartons"
  mistake stays impossible.

Built 2026-11-12 (mock-up first: packet size box, a pantry row, the
cooking sheet). A count is read in pantryStock.ts (`quantityOf`, with
`packet` for a size: "12 x 60 g" is 12 eggs, but in a recipe "2 x 400 g
tins" isn't 2 tomatoes). A line counts only when the item's own name
follows the number, with nothing but describing words before it ("2 large
free-range eggs") and nothing after it that makes it another thing ("2
celery stalks", "12 cherry tomatoes", "4 spring onions", "2 corn
tortillas" all stay "can't tell"; found in review). So the shopping list's "Enough: 2 × 12 eggs" /
"Have 1" and the "Used anything up?" sheet use it with no change of their
own. What's short is bought in whole ones ("2 eggs", never "1½"). A
corrected scanned size was already remembered for its barcode
(server/pb_hooks/pantry_products.js rememberProduct), so the next scan says
12 by itself; Open Food Facts' "x12" now reads as "12". Left out of the
mock-up: the row summary "21 eggs · 2 cartons" and a "Used some…" button
(the labels already say "about 9 left"; using some by hand would be new).

## Next: tell Play users when an update is out (Xel, 2026-11-08)

Built 2026-11-08, released in 1.20.0:
@capawesome/capacitor-app-update 8.1.1, `updatesFromPlay` in
appUpdates.ts, the same banner with "Restart to update" once Play has
downloaded it, and "Check for updates" in the ⋮ menu (phone-only mode
too). Only testable with an install from Play: install the current
version from the internal testing track, upload a higher one, then open
the app.

The Play version had no update banner, because Play forbids an app
installing its own updates (`canSelfUpdate` in appUpdates.ts), so people
waited for Play's background auto-update. Google's own in-app updates
(Play Core's app-update library; a Capacitor plugin like
@capawesome/capacitor-app-update wraps it) are allowed: the app asks Play
whether a newer version is out and shows Play's prompt, and Play downloads
and installs it. Use the "flexible" kind (download in the background while
the app's in use, then a restart), shown in the same spot as the
household's banner ("Bentotachi 1.20 is ready", Later / Update), Play
version only. Works for testers on the testing tracks too; only an
install from Play can use it. Xel chose this over a plain notice linking
to the Play listing.

Goes with an idea still to decide: a one-time "What's new in 1.20" note
after updating (both versions), linking to the website's changelog.

## Spelling that follows the household's region (Xel, 2026-11-08; built the same day)

Text people see is written in Australian spelling (colour, favourite,
grey), Xel's choice for their projects. A household whose Country is the
United States sees American spelling instead (color, favorite, gray):
`useSpell()` in household.ts and the word list in spelling.ts. Everywhere
else keeps the Australian spelling, which suits the UK, New Zealand and
others. Code names and stored values (`favorite`, `color`) stay as they
are. New text with a listed word goes through `spell()`;
web/test/spelling.test.ts fails on one that doesn't. A word that differs
but isn't listed yet (organise, centre) gets added to the list when it
first appears on screen.

## To consider: ideas from the Paprika comparison (Xel, 2026-11-07)

From research/reports/Paprika compared with Bentotachi.md (local only),
section "Twenty ideas worth taking". Xel wants all of them in the plan.
None is scheduled yet. Already done or already planned elsewhere, so not
repeated here: several photos per recipe and step photos, nutrition facts,
pasting a recipe as text, carrying Paprika ratings, favourites and photos
across, reading steps aloud ("talking to Bentotachi" above), social media
captions and scanning a cookbook page ("more ways to bring recipes in"
below), exporting everything ("more personality"), and expiry reminders
("Ideas for later").

1. **Remember aisle corrections** (small to medium): move "tahini" to Tins
   & jars once and it stays there for the household (aisles.ts guesses
   from words today). Later, maybe each household's own aisle order.
2. **Add up quantities** (medium): "2 eggs" and "3 eggs" on the list
   become one line, "5 eggs". scaling.ts already reads amounts; units
   that don't match ("1 cup" and "200 g" flour) stay separate.
3. **Reusable menus** (medium): save a week, or a set like "Taco Tuesday",
   and drop it onto the plan in one go.
4. **A Trash for deleted recipes** (small to medium): a deleted recipe
   waits a while before it's really gone, since one person's delete
   reaches the whole household. Undo already exists for the list, the
   plan and packets; recipes only ask first.
5. **"Last cooked" sort** on the Recipes page (small): "what haven't we
   had in ages?". The cooked log already has the dates (also noted as an
   idea in the 1.9.0 notes).
6. **"We have it" on recipe cards** (small): the pantry match the dinner
   chooser already shows, on the Recipes page too.
7. **Home-screen widget** (medium, native Android): the shopping list or
   tonight's dinner, at a glance. AnyList's widget not updating until the
   app is opened is the warning.
8. **Calendar feed of the plan** (small to medium, a server route): a link
   a calendar app subscribes to, so dinners show beside appointments.
   Needs a plain warning that anyone with the link can read it, and
   Google Calendar can't reach a Pi that's only on Tailscale.
9. **Links from one recipe to another** (small to medium): "make the
   [Pizza dough]" in a step opens that recipe. Paprika files already use
   `[recipe:Name]` marks, so import and export could carry them.
10. **Several shopping lists** (medium): say, the supermarket and the
   hardware store. For a household of three, only if someone asks.
11. **Wear OS shopping list** (big): tick things off from a watch.

## To consider: more ways to bring recipes in, and more photos (Xel, 2026-11-07)

Compared with Paprika 4 (released 2026-11-06), what Bentotachi saves from
a recipe page now matches other apps (nutrition was the gap). What's
missing is how recipes get in. Xel: 1 and 2 are wanted soon.

Done 2026-11-07 (see "Importing on par with Paprika, round two" above):
1, 2, 7, 8, 10 and 11 (a shelf or your favorites from Import & export;
one recipe from its page's ⋯ → Save as a Paprika file). Still open: 3–6,
12, 13.

1. **"You already have this"**: adding a link already saved quietly
   makes a second copy today. Warn instead, with "Open it" and "Add
   another copy" (Paprika 4 warns). Small: look for the same source_url
   (and the same link without www/https differences) before importing,
   in the Add page, the share route and the built-in browser's Save.
2. **Paste a whole recipe as text**, split into ingredients and method
   for you (Paprika 4's "Create from Clipboard", Premium-only there).
   Reuses recipe_parse.js's plain-text recipe reader (findPlainTextRecipe,
   made for blog posts). Covers recipes in messages, emails and copied
   TikTok/Instagram captions.
3. **Our photos, and step photos** (Xel, 2026-11-07), in three parts:
   - *Done (part 1):* up to 20 photos per recipe besides the cover
     (`photos`, shrunk to 1600 pixels), added from ⋯ → Add photos,
     swiped through at the top of the recipe page; tapping one opens it
     full size (PhotoViewer) to put it with a step, make it the cover or
     remove it. A step's photos show in its card (`photo_steps`, kept when
     the step is reworded: recipePhotos.ts). Duplicate copies them.
     Offline copies show the cover only.
   - *Done (part 2):* Paprika files bring their gallery in (`photos`,
     paprikaPhotos), a `[photo:Step 3]` mark in the directions putting its
     photo on that step (paprikaStepPhotos), and our export takes both
     out (photos named "Step 2", "Photo 1", marks at the end of their
     steps). The round trip through our own files is tested; Paprika
     itself reading our gallery still needs trying on a phone.
   - *Done (part 3):* "Bring step photos" in the ⋮ menu (each person's
     own, `users.website_step_photos`, off by default): saving from a
     link then also downloads the photos the page gives its steps
     (schema.org HowToStep `image`, recipe_parse.js `stepImages`, up to
     20) and shows each in its step (import.pb.js). Xel chose this over
     always or never: step photos can be 15+ per recipe, which fills
     phone-only phones and backups for people who don't want them.
     Tried on Allrecipes: 4 step photos, each on its step.
   Paprika (photos linked from the directions by name), Mela and Crouton
   have several photos; Mealie and Tandoor put photos on steps.
4. **Scan a cookbook page from a photo**: Android's on-device text
   recognition (Google's ML Kit; free, offline), its text fed to 2's
   reader. Needs a native plugin like the barcode scanner's.
5. **Straight from TikTok, Instagram or YouTube**: those sites block
   automated reading; Paprika does it through its own servers, with an
   account and usage limits. 2's paste covers most of it without that.
6. **Highlight text on a page to fill a field** in the built-in browser
   (Paprika's "clipboard tools"), for pages that won't import. Today the
   fallback is "Add by hand".

Not missing: a review screen before saving (Paprika shows the filled-in
form first; Bentotachi saves and lets you edit, fewer taps).

A full pass over Paprika's import, export and file fields (research
notes, section 2, 3 and 9) found these too:

7. **Paprika's photos are only small previews**: checked in a real
   Paprika 4 export (Xel's phone, 2026-11-07, free version): every
   recipe's `photo_data` is a thumbnail, at most 280×280 px (~20 KB), even
   for recipes that went in with full-size photos; `photos` was empty and
   `photo_large` null. So a Paprika collection comes in with blurry,
   stamp-sized photos on every recipe page. Recipes Paprika saved from a
   website also carry `image_url`, the site's full-size photo. Fix:
   fetch `image_url` when there is one (through the server, like the link
   import's photo; browsers can't fetch other sites' images), use a
   `photos` entry if a paid Paprika fills it, and keep the preview only
   as a last resort (the summary could say how many only had a small
   one). Paprika 4 also adds `prep_minutes`/`cook_minutes`/`total_minutes`
   as numbers and `servings_min`/`servings_max`; the text versions the
   import reads are still there.
8. **Paprika 4's formatting leftovers**: numbered steps ("1. Preheat")
   would show numbered twice; `[recipe:Name]`, `[photo:Name]` and
   `[title](url)` links show as raw text. Strip the numbers, keep the
   names and titles.
9. ~~Paprika 4 cookbooks as tags~~: its export carries only
   `cookbook_uid`, an id with no name (and empty on all 50 recipes in
   Xel's export), so there's nothing to name a tag with. Dropped.
10. **Open a Paprika file with Bentotachi** from Files, email or chat
    (Paprika opens `.paprikarecipes` attachments as imports): an Android
    intent filter for the file, landing on Import & export with it.
11. **Export part of the collection**: one shelf or tag, or one recipe
    to send to a friend (Paprika exports by cookbook and category, and
    shares a single recipe as a Paprika file). Today it's everything.
12. **A readable export**: a recipe web page per recipe plus an index,
    with schema.org recipe data, that opens in any browser and other apps
    can read (Paprika's HTML export). Lower priority.
13. **Other apps' backups**: several apps (Copy Me That, Recipe Keeper,
    Paprika's HTML export; to check with real files) export zips of
    recipe web pages, which the importer already reads one at a time
    (Add → saved web page). Taking the zip could cover several apps for
    little work. Paprika's old formats (MasterCook, MealMaster, Living
    Cookbook, Cook'n, Pepperplate, My CookBook, YAML) aren't worth it.

Left out on purpose: Paprika's "Analyze Ingredients" (Premium: nutrition
estimated from a USDA food match per ingredient); big, and an estimate.

## To consider: changing things offline (Xel, 2026-11-11)

Offline, only the shopping list can be changed (ticks and adds wait and
go later, offlineShopping.ts); the plan, pantry and fridge show their
saved copy for reading. Xel wants to revisit changing them offline too
("another time"). Each would need what the shopping list has: changes
kept in a queue on the phone, sent in order when the server answers,
safe to send twice (their own ids), and a check that a housemate's change
meanwhile isn't overwritten. The pantry is the one most wanted in a shop
(counting what's bought).

## Photos offline, opt-in (Xel, 2026-11-11)

Decided (Xel, 2026-11-11): build it, with cover and step photos, filling
over any connection (not Wi-Fi only). Built 2026-11-12 (see "Not released
yet"); what's below is the background.

Xel asked whether photos could be kept on the phone too, as something
people turn on if they have the room. Measured on the Pi (2026-11-11):
the recipe photos' 600-wide copies (what cards, the plan and step photos
show) are 90 photos, 18 MB (about 200 KB each; the few WebP ones are
much bigger, about 600 KB, because the server's thumbnail keeps the
original format); the pantry's small square photos are 1 MB for 222.
So a household cookbook is tens of MB, growing with each photo.

Shape so far: a switch in Settings, "Keep photos for offline (about
N MB)", with the size worked out from the household's photos; the app
then saves the 600-wide copies (and pantry squares) in the browser's
own cache (Cache Storage, which has far more room than the text
copies' storage) and shows them from there when offline; switching it
off empties that cache.

## To consider: bought things into the pantry (a tester, 2026-11-12)

A tester expected ticking or clearing bought shopping-list rows to offer
adding them to the pantry. Today only a row linked to a pantry item (one
added because the item ran out) sets that item back to Have and adds a
packet (pantry.pb.js); a hand-typed "milk" isn't linked even when the
pantry has Milk. Possible shape: link a typed row to a pantry item of the
same name when it's added, and on "Clear ticked items" offer to add the
unlinked ones to the pantry. Not decided; not a bug.

## To consider: taking things off the pantry again after cooking (Xel, 2026-11-12)

Twice a tester expected ticking a recipe's ingredients to take them off
the pantry, and once added packets after marking a recipe cooked, then
found no way back to "Used anything up?". Today the sheet comes only once,
when "We cooked this" / "Finished" is pressed (cookedUses.ts,
UsedUpSheet.tsx); the ingredient ticks are only a checklist, and they
reset on leaving the recipe. Xel wants it to be intuitive; how is open.
Some shapes to weigh (mock-up first):

- A "Used anything up?" link beside the cooked stamp ("Cooked today ·
  Undo"), so the sheet can be opened again that day. Smallest; the sheet
  already knows what to offer.
- The ticks feed the sheet: ingredients ticked while cooking come in
  ticked, unticked ones unticked, so ticking means "I used this". Keeps
  the one confirming step, so a stray tick never takes anything off.
- Ticks that take things off straight away, with Undo: the most direct,
  but a checklist tick that changes the pantry can catch out someone who
  only ticks to keep their place, and the sheet's "Take them off" step is
  what lets a household check before anything comes off.
- Keeping the ticks while the recipe is being cooked (until it's marked
  cooked, or the next day), so leaving for the timer or the list doesn't
  lose them.

Not decided; not a bug.

## Ideas for later

- Phone notifications when something is about to expire
- Different lunches per person (meal prep) while dinners are shared: only
  if someone actually asks (Xel, 2026-11-06). It means a "whose" field on
  plan entries and dropping the one-meal-per-slot rule, on phones too.
  Meanwhile a note in the lunch slot does it ("Sam: chicken bowls · Alex:
  pasta salad"), and a weekly "meal prep" may fit better than daily slots.
- A servings slider like fancy recipe sites (mocked up 2026-11-06: big "6
  servings", a 1–12 slider with an "as written" mark): only if enough
  people ask (Xel). The stepper card stays meanwhile.

## To fix later

Known bugs and review findings waiting to be fixed are in `TODO.md` at the
repository root, kept on the PC only (not on GitHub; see CLAUDE.md).

## Known limits

- Some big recipe sites (seen: AllRecipes, Serious Eats, Budget Bytes) block
  Bento's server with 402/403 errors, so importing their links fails and the
  app offers "add by hand". The Android app's built-in browser fixes this.
- Scaling reads the amount a line starts with and amounts written right
  after it (web/src/scaling.ts); amounts inside the method aren't changed.

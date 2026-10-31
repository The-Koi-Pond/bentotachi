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
- **Tailscale** (free) will let phones reach the Pi away from home without
  exposing it to the internet. It also provides the HTTPS address, which
  Android apps need before they can talk to a server.

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
   - [ ] Everyone switches their app's server to the Pi's address.
   - [ ] `tailscale serve` for an HTTPS address, then an app update that
         turns off `cleartext` (insecure connections).
6. **Public on GitHub** (github.com/The-Koi-Pond/bento):
   - [x] Household details moved to private files (`web/scripts/pi.json`,
         `CLAUDE.local.md`); made-up examples in the code and docs.
   - [x] Website in `site/` (landing page and privacy policy), published by
         `.github/workflows/pages.yml`.
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
   - [ ] Try it on a real phone ("Bento (test)", `-PbentoTest`): first
         start, adding and importing recipes, photos, closing and reopening,
         backup and restore.
   - [ ] Privacy policy: Android's own backup (`allowBackup`) can copy a
         phone-only Bento to the person's Google account; say so.
   - [ ] When `cleartext` is turned off, still allow 127.0.0.1 (the phone
         server) in a network security config.
8. **Google Play** (Android only for now):
   - [ ] Developer account (US$25 once, ID check). New personal accounts
         need a closed test with 12+ testers for 14 days before going public.
   - [ ] A Play build without the self-updater: no "new version" banner or
         APK downloads, and no `REQUEST_INSTALL_PACKAGES` (Play only allows
         it for app stores).
   - [ ] Replace or drop the stores' logos (Coles, Woolworths, Walmart,
         Target, Kroger) in the Play build; Play is strict about other
         brands' logos.
   - [ ] App bundle (.aab), Play App Signing, store listing, data safety
         form, privacy policy link (the website's privacy.html).
   - [ ] Play-signed builds can't update self-installed ones: everyone
         reinstalls once (recipes are safe on the server).

## Waiting for the next app release

Changes already live in the browser version, not yet in a published APK
(they go into the next `npm run release`'s notes):

- Pantry fixes from Xel's first big scanning session (new `note`,
  `opened_location` and `opened` fields on pantry items; `brand` holds up to
  120 characters):
  - A scan nothing has (Open Food Facts doesn't know it) shows the number and
    asks to scan once more: the Pi's log showed the scanner often misreading
    the first few digits. Two matching scans, a typed number, or "It
    matches" count as sure.
  - Same thing, another brand: a scanned product named like a pantry item
    offers "Add to Brown sugar" (barcode goes on it, brand joins its brands,
    "Coles, White Mill"). Typing a name already used offers the same button
    instead of only an error. "Preferred brand" is now "Brands we buy".
  - "Once opened, keep in" (like Fridge): the row gets "Opened → Fridge",
    which moves it there; marking it Out puts it back in its own place.
  - A note on each item ("3 cans"), shown under its name.
- The Netherlands as a household country (guessed from the Europe/Amsterdam
  time zone too): Albert Heijn, Jumbo, Plus and Dirk in the pantry's store
  search, with their logos. Plus's and Dirk's searches were checked; Albert
  Heijn's and Jumbo's block automated browsers from Australia, so a Dutch
  tester should try them. Product names from Dutch links and titles are
  tidied ("Nu bij Dirk", "bestellen", Jumbo's "-67649PAK", "6 stuks").
- Spoons and millilitres (web/src/volumes.ts; new `tablespoon` field on
  household_settings): "Our tablespoon" on the Household page (15 ml, or
  the Australian 20 ml). A recipe's tablespoon is guessed from its website
  (`.au` sites: 20 ml; RecipeTin Eats uses 15 ml), and when it isn't ours
  the hint says "2 tbsp (your 1 tbsp + 2 tsp)". Outside the US, cups (not
  in Australia), fl oz, pints, quarts and gallons get ml; in the US, ml and
  litres get cups or spoons. "1-1/2" now counts as one and a half (it was
  read as 1 to ½, in weight hints too). Phone-only mode gets the Household
  page as "Country & spoons" (it had no way to change the country before).
  Not done: a per-recipe spoon choice, for recipes typed in from an
  Australian cookbook (they count as 15 ml).
- From the review (docs/REVIEW.md): the importer refuses addresses on this
  computer or the home network, for the page and for its photo
  (server/pb_hooks/safe_url.js). Live on the Pi with `npm run deploy`; the
  phone-only server gets it in the next APK.
- The shopping list works offline: the phone keeps a copy (and the pantry
  items it shows brands from); ticking off and adding work with no signal,
  are shown straight away, and are sent when the server can be reached
  again (the "back online" event, coming back to the app, Try again, or
  every 30 seconds). Removing and "Clear ticked" wait for a connection.
  Lists never load from the browser's own cache any more.
- Undo: removing a shopping item, "Clear ticked items" and taking a dinner
  off the plan show "Removed … Undo" for 6 seconds before really deleting.
  Deleting a recipe now says what goes with it ("Its 2 nights on the
  dinner plan and 1 rating will be deleted too.").

Released in 1.10.0 (2026-10-31; Xel is trying the scanner on their phone):

- Barcodes in the pantry (new `barcodes` field on pantry items, and
  `/api/cookbook/barcode/{code}`, which asks Open Food Facts): "📷 Scan" in
  the app (Google's scanner screen, no camera permission) or the "Barcode"
  box in a browser (typing, or a USB scanner). A barcode Bento knows shows
  its item to mark Have / Low / Out or edit; a new one opens "Add item"
  with the name and brand filled in, or goes on an item already there under
  another name. The edit form lists an item's barcodes (✕ to remove, 📷 to
  add). Privacy policy mentions Open Food Facts. Scanning itself still to
  be tried on a phone.

Released in 1.9.0 (2026-10-31; 16 MB now, as it carries the phone server
for phone-only mode, which only shows on a fresh install):


- Importing from older recipe blogs (EasyRecipe and similar plugins, which
  label the visible recipe card with "microdata" instead of JSON-LD), for
  pasted links now (after a server restart) and Save to Bento in the app.
  "For the chicken:" lines become headings and "." spacer lines are dropped.
- Importing from sites whose recipe data is only added by a script (seen:
  PureWow), steps that run together ("…1 minute.2. Add…") split into
  separate steps, and photos kept even when the site labels them vaguely
  ("binary/octet-stream"). Server-side: needs a server restart.
- Import errors: "add it by hand" in the message is now the link (no
  separate "Add it by hand instead"), and the big Add by hand button also
  carries the link that failed, so Original link is filled in.
- A ✕ in Add recipe's link box empties it (and its error) to try another.
- Importing recipes written as ordinary text in a blog post (an
  "Ingredients" line, short ingredient lines, then paragraphs; seen:
  ladyandpups.com), as a last resort: reads only the post, stops at
  "Related posts" and the like. Pasted links need a server restart; Save
  to Bento in the app sends the post and its title (next APK).
- The login screen's "Recipes · Plan · Pantry · Together" line under the
  title.
- Recipe categories as shelves: the Recipes page opens on one collapsible
  shelf per category (Mains, Desserts, One-pot, Instant Pot…, then
  "Everything else"), each holding all its recipe cards. A
  category is a name plus every tag that counts for it, edited on the
  Categories page ("Categories" beside the recipe count). Closed shelves
  are remembered per device, or with "Categories start closed" (⋮ menu)
  every shelf starts closed each time Bento opens. Search and filters show
  the plain list, as does "One list" (also beside the count).
- Tag suggestions in the recipe form: "Suggested for this recipe" (known
  tags its name, description or ingredients mention, like beef or
  noodles), "Tags you've used" (tap to add; narrowed to a half-typed tag)
  and "Put on a shelf" (tap a category to add or remove it).
- Delete mode replaces Manage mode: the top bar's bin button puts a red bin
  on every card on screen (shelves or list); tapping one asks, then deletes
  that recipe. ✓ ends it. No more select-then-Delete bar.
- Single-user mode, automatic: a Bento with one account hides who added
  what, says "Share Bento" instead of "Household" in the ⋮ menu, and drops
  "for everyone" from delete questions. Adding a second person brings it
  all back. (Friends' zip: rebuild after the next release.)
- Leaving out tags on the Recipes page: the tag panel's "Show recipes
  With | Without" switch; Without hides recipes with that tag
  ("without spicy ×" above the list, #/?not=spicy). Mixes with the rest.
- Author's notes: the recipe writer's tips, kept apart from Our notes.
  Imports fill them from the page's notes box (WP Recipe Maker, Tasty
  Recipes, Mediavine Create); editable in the recipe form. Save to Bento in
  the app sends the notes box too (next APK). Older recipes start empty.
- Editing on the recipe page: a ✎ beside the details (name, description,
  servings, times), Ingredients, Method and each notes section edits just
  that part, with Save and Cancel; "+ Add our notes" / "+ Add author's
  notes" when empty. Quick tags: "+" after the tags opens × on each, a box
  for a new tag and the form's suggestions; each change saves at once. The
  Edit page stays for the photo and link. "Add to shopping list" moved
  under the ingredients.
- (Server, live already) Imports drop WP Recipe Maker's stray comma in
  ingredient brackets ("garlic (, minced)" -> "garlic (minced)"); a
  migration fixed the 89 such lines in 14 older recipes, moving any pantry
  link with its line.
- Words in *asterisks* in a recipe's description, ingredients, method,
  headings and notes show as soft grey italics, and **double asterisks**
  as bold; the shopping list gets the words without the asterisks. Form
  and inline-editor hints mention both.
- Method step numbers start again at 1 under each "# " heading, like recipe
  sites (a separate part, like a sauce); a "## " heading carries on counting
  (the next stage of the same part). Hints in the form and ✎ editor say so.
- Country, for the whole household (Household page): decides the Pantry's
  grocery stores. Australia: Coles, Woolworths; United States: Walmart,
  Target, Kroger; Somewhere else: no store search (pasted links still
  work). Existing Bentos start as Australia; a new one guesses from the
  first browser that logs in (time zone, then language). Friends' guide
  mentions it. (Friends' zip: rebuild after the next release.)
- Regional ingredient names (regionalNames.ts: capsicum/bell pepper,
  coriander/cilantro, spring/green onion, prawn/shrimp, plain/all-purpose
  flour, beef mince/ground beef…): pantry items link to the other
  country's name, search finds both (the swapped name as one phrase), and
  recipe lines show the household's word as a soft hint ("bell pepper
  (capsicum)"). Only certain meanings: no hints for plain "mince",
  "tomato sauce", or "coriander" (could be the ground spice in the US).
- Photo framing: double-tap (or double-click) a recipe's photo, or "Adjust
  photo" on the Edit page, to drag it and zoom (1-3x). Saved as
  image_framing; the photo file is untouched, so Reset undoes it. Used on
  the recipe page, cards, dinner plan and chooser (cards now use an
  uncropped 600-wide thumbnail). A new photo starts centred. Zoom enlarges
  the photo in place and clips it back (works in every browser, checked
  in Firefox and Chrome); the boxes around photos clip too, so pages don't
  scroll sideways.
- Weight hints (weights.ts): pounds and ounces get grams in Australia (and
  "Somewhere else"), grams and kilos get pounds and ounces in the US, as a
  soft hint after the amount ("1½ lbs (680 g)"). Fractions, ranges,
  "(14.5-ounce) can" and the like; not fl oz, not lines that already give
  both, not "pound" the verb. Cups and spoons are left as they are. On the
  live recipes: 110 lines get grams; the US direction gives 39.
- Temperature and length hints, the same way (temperatures.ts, lengths.ts):
  °F gets °C rounded like an oven dial (350°F (180°C)), °C gets °F to 25s;
  under 100°C stays exact (165°F (74°C)). A bare "C"/"F" only counts at
  oven-sized numbers ("1 C" can be a cup). Inches get cm ("1-inch (2.5 cm)",
  "9x13 pan (23×33 cm)"), cm get inches with ¼s for the US. Live recipes:
  9 temperature and 37 length lines hinted for Australia.
- Buttons: Save (or Add, Update) in the right-hand corner with Cancel just
  before it, everywhere; Delete/Remove/Reset on the far left.
- The favourite heart sits on the photo's top-right corner, hanging a little
  off the edge (cards and recipe page), on a solid circle. The ⚡ quick badge
  is bright yellow on a dark disc with a white ring, so it shows on yellow
  and brown food.
- Shelves can be dragged into a new order on the Recipes page by the grip
  before each name (or Space, arrows, Space on a keyboard); the shelf it
  would land on is outlined. Saved for the household, like ↑ ↓ on the
  Categories page. "Everything else" stays last.
- Recipe timer: "⏱ Time it" under a recipe's times starts a prep-then-cook
  stopwatch (Pause, Stop, "No prep, start cooking"). It's kept per recipe
  on the device and works from start times, so it survives leaving the page
  or the screen locking. At the end it compares with the recipe's own times
  and "Save these times" sets prep, cook and total (rounded to 5 minutes).
- "✓ We cooked this" on a recipe page (new `cooked` collection): records
  today for the household, with Undo. Finishing the timer does it too.
  "Last had" (recipe page, dinner chooser) now counts these as well as past
  plan nights, each day once; "Not cooked yet" when there's no history.
  Idea for later: a "Last cooked" sort on the Recipes page.
- Extra times on a recipe (new `extra_times` field): "+ Add a time" in the
  ✎ editor and on the Edit page adds named ones like Cool 7 h or Release
  10 min (common names offered; "= 7 h" shown for long ones). They show
  between Cook and Total, and count in the total when the recipe doesn't
  give its own (so ⚡ quick and the Quickest sort see them too).
- B / I / U buttons above the recipe text boxes (description, ingredients,
  method, both notes; Edit page and ✎ editors), and Ctrl+B / I / U: select
  words and press one. I is the soft grey italics; U is new (__like this__);
  they combine. Ctrl+Z undoes them.
- Unsaved changes: with an editor changed (Edit page or a ✎ editor), going
  to another page (links, tabs, back, Android's back gesture) asks "Leave
  without saving them?"; Escape asks before throwing changes away; closing
  or reloading the tab gets the browser's warning. Also for a half-typed
  shopping item, adding or editing a pantry item, editing a shelf, the
  Profile name and password, adding a person, and adding a recipe site.
- Author's notes and our notes show like the method: each numbered ("1." / "**1. Rice**")
  or dashed note in its own box with its number (or a dot); lines under a
  note stay with it.
- Adding or editing a recipe by hand strips the ▢ tick-boxes copied from
  recipe sites off the start of ingredient and step lines.
- Smarter pantry guesses: a name that's only part of a different product
  no longer links ("rice vinegar" isn't Rice, "coconut milk" isn't Milk,
  "garlic powder" isn't Garlic, "chicken stock" isn't Chicken).

Released in 1.8.0 (2026-10-30):

- Household page (⋮ → Household): everyone with an account, and "+ Add
  someone". New servers show "Set up your Bento" on the login screen. Needs a
  server restart (users create rule, placeholder admin for new servers).
- Fix: the app's Server address box refused addresses without http://
  (like its own "100.64.12.34:8090" example). Release before sending
  friends a zip (npm run package), so their app has this fix.
- The Recipes tab's Tags button is just the tag icon, matching ⚡ and ♥.
- Filter recipes by who added them: an "Added by" row of people (in their
  colors) in the tag panel, combining with tags; "Added by Sam" on a
  recipe page links to everything Sam added.
- Thumbs down on recipes, with reasons as tags ("baked pineapple"), added
  with a + at the end of the tags (no box until you tap it), suggested from
  your earlier reasons, shown to others by tapping your
  rating pill, and a 👎 on recipe cards. Up and down are either/or. Needs a
  server restart (new `disliked` and `dislike_reasons` fields).

Released in 1.7.0 (2026-10-30):

- Slimmer top bar: Manage, + and the menu are matching 36 px circles with
  20 px icons, a smaller title, and the ⚙ menu button is now ⋮.
- Profile page (top of the ⋮ menu, showing your picture and name): profile
  picture (cropped to a 400 px square on the phone), display name,
  username, My color (moved out of the menu; Quick means stays there), and change
  password (logs out other devices, keeps this one logged in).
- Pantry links fix: a pantry item added from the link panel shows on the
  ingredient at once (no waiting for live updates), and a link the server
  doesn't keep (one not restarted since links were added) now says so.
- Store links for pantry items: "Search stores" on the Pantry tab (Coles,
  Woolworths), a Store link per item (shown as "Coles ↗" on the item and on
  the shopping list), and in the app "Find on Coles" opens Bento's browser
  with a "Link this item" button. Needs a server restart (new `store_url`)
  and the next APK for the Link this item button.
- Add to the pantry straight from a store page: sharing a Coles or
  Woolworths product page to Bento opens Add item with the link and a
  suggested name; in the app, Search stores has "Add from Coles" (Bento's
  browser with an "Add to pantry" button); pasting a store link into a new
  item suggests its name.
- Coles and Woolworths logos instead of their names on store links,
  searches and buttons (their site icons, kept in the app).
- Preferred brand for pantry items ("Lea & Perrins"): shown under the item
  and on the shopping list, and included in store searches. Needs a server
  restart (new `brand` field).
- "(optional)" sits beside its field's name, smaller and fainter.

Released in 1.6.0 (2026-10-30), after a server restart and a backup of
pb_data in backups/:

- Dinner plan: "+ Add dinner" opens a chooser panel that slides up: search
  names, tags and ingredients, ♥ Favorites and ⚡ Quick chips, the full
  scrolling list with time and stars, and a note when a recipe is already
  planned. The Android back gesture closes it.
- Dinner plan notes: a night can hold a note ("Take-away night") instead of
  a recipe, typed or from Take-away / Leftovers / Eating out chips; notes
  drag and swap like recipes. Needs a server restart (new `note` field).
- Pantry links on recipes: Have / Low / Out chips beside ingredients, a
  panel to change a link or add the item to the pantry, linked shopping
  items, and "Select what we need". Needs a server restart (new
  `ingredient_links` field).
- Plan tab "Shop for these": gathers the ingredients of the dinners in the
  next 7 or 14 days into one list, merging repeats ("Onion, for Curry, Egg
  fried rice"), skipping "not a pantry item" lines, unticking what we have,
  and showing what's already on the list.
- Dinner chooser: "🎲 Surprise me" picks a random recipe from those shown
  (not one already planned, if possible) with Plan this / Another; a
  "🥕 We have it" chip (nothing linked is out); "Out of Rice" notes.
- Recipes tab: Sort menu (A–Z, Top rated, Newest, Quickest), remembered on
  each device, and a recipe count.
- Browse tab "Our sites": the household's own recipe sites (add with
  "+ Add a site", remove with ✕), shared by everyone; searching includes
  them through Google. Needs a server restart (new `saved_sites`).
- "Last had" history from past nights on the plan: on recipe pages ("Last
  had 2 weeks ago (Tue, Oct 14) · 3 times · Next: Mon, Nov 2") and in the
  dinner chooser ("Had 2 weeks ago").
- New look: the onigiri app icon (on peach) and launch screen, and the
  drawn "Bento" title in the top bar and on the login screen (cream letters
  in dark mode). The icon and launch screen only change with the next APK.
- Share to Bento (Android share menu) and offline reading of recipes.

Released in 1.5.1 (2026-10-30): log in with a username instead of an email (email optional; email
  logins still work). The login screen says "Username", and its server
  address hint is updated for Tailscale. Needs a server restart.

Released in 1.5.0 (2026-10-30): dinner plan with list and month views,
quick recipes, personal colors, thumbs up and rating pills, hearts on
recipe pictures, and the ratings box layout.

## Ideas for later

- Scaling servings (needs ingredient amounts parsed out of the text)
- Phone notifications when something is about to expire

## Known limits

- Some big recipe sites (seen: AllRecipes, Serious Eats, Budget Bytes) block
  Bento's server with 402/403 errors, so importing their links fails and the
  app offers "add by hand". The Android app's built-in browser fixes this.
- Imported ingredient lines are plain text. Nothing understands "2 cups" yet.

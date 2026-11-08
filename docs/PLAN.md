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
         "Waiting for the next app release").
   - [x] Store listing: 512 px icon, 1024 × 500 banner, 2 to 8 phone
         screenshots without store logos, short and long description,
         content rating questionnaire, target audience (2026-11-06: text
         and answers in docs/PLAY-LISTING.md, pictures in branding/play/
         from branding/make_play_listing.py; entering them in Play Console
         is Xel's, below).
   - [ ] 12+ testers lined up, and a way for them to send feedback.

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
   - [ ] In Play Console (Xel): Play App Signing with Bento's key as the
         upload key, store listing, data safety form (answers drafted in
         docs/PLAY-DATA-SAFETY.md, 2026-11-06), privacy policy link
         (thekoipond.dev/bentotachi/privacy.html).
   - [ ] Play-signed builds can't update self-installed ones: everyone
         reinstalls once (recipes are safe on the server).

## Waiting for the next app release

Changes already live in the browser version, not yet in a published APK
(they go into the next `npm run release`'s notes):

Not released yet:

- Websites' ingredient sections ("Marinade", "Sauce") come in with the
  recipe; "Re-import from the website" in a recipe's ⋯ menu.
- "Amounts in the method" (⋮ menu, off unless turned on).
- Tips behind a "?" (recipe formatting, the plan, Import and Export, the
  tablespoon, filling a shelf).
- A site's category page (a tester's idea, 2026-11-08): pasting
  one, or saving one in the app's browser, lists its recipes to tick and
  add at once, with "More from this page" for the next lot. Their second
  idea, site buttons on Browse with the site's categories in the app, is
  covered for now by the site's own menu in the app's browser (Browse
  opens it there); in-app category lists per site would need keeping up
  as sites change, so they wait for Xel's call.

Released in 1.19.0 (2026-11-08, deployed the same day):

- Recipe photos: up to 20 besides the cover, step photos shown in their
  steps, a swipeable strip and a full-size viewer; "Bring step photos"
  (⋮ menu) brings a website's step photos; Paprika files carry them both
  ways.
- Step timers ring with the phone locked (an Android notification), and
  still beep in the app when it's on screen.
- The plan: more than one recipe per meal ("+ Dinner"), the list starts
  at yesterday, the recipe page's Plan adds alongside.
- Shopping: a recipe's Add to shopping list offers All, Missing from
  pantry or Choose; "+ Add from a recipe" on the list; items keep the
  recipe's words minus how to prepare them.
- Recipes: small cards, big cards or a list; a tidier toolbar (Close all
  shelves, a View panel); recipes remember their servings; the Recipes
  tab returns to the recipe you were on; Add recipe only on Recipes and
  Browse.
- Tester fixes: Scan a barcode in an empty pantry; the Plan popup fits a
  phone; list cards fill their space again; Browse's corners; nutrition
  says it's the recipe's own numbers.

Released in 1.18.0 (2026-11-07, deployed the same day):

- Backlog fixes for testers (2026-11-07): the built-in browser no longer
  opens the Play Store (or any app) by itself when an ad redirects, only
  on a tap; Save there finds "What you'll need" headings (curly
  apostrophe too); a backup saved while Android closed Bentotachi in the
  background still lands where it was picked, with a message; "Restored
  from the backup." after a restore; "1 cup" not "1 cups" when scaling;
  a quick heart-then-star on an unrated recipe no longer errors;
  rewording an ingredient keeps its pantry link (both editors, read fresh
  so a housemate's link isn't undone); "Shop for these" drops formatting
  marks; a brand that repeats the name ("Nutella") isn't shown twice;
  household settings no longer flash back to defaults on a login renewal.
- The recipe page tidied (Xel, 2026-11-07): Ingredients and Method are
  cards of their own (the scaling box and the steps inside are light rows,
  not cards in a card), and a ⋯ beside Plan and Edit holds Share, Save as
  a Paprika file (one recipe, to send to a friend: paprikaSave.ts, shared
  with Import & export), Print (browsers), Duplicate ("Lasagne (copy)",
  with its photo, opened in the editor; ratings and history stay with the
  original) and Delete (still asks first; it was a red button at the
  page's end). RecipeMenu.tsx; ShareButton.tsx is gone.
- Importing on par with Paprika, round two (Xel, 2026-11-07; the list
  under "To consider: more ways to bring recipes in"):
  - "You already have this": importing a page already here (by its link,
    however it's written: recipe_parse.js linkKey) offers "Open it" or
    "Add another copy" instead of a second copy, for a pasted or shared
    link, the built-in browser and saved pages (import.pb.js answers 409
    with the recipe; recipeImport.ts, AlreadyHere.tsx).
  - Paste a whole recipe as text (Add recipe → "Type or paste it in" →
    "Sort it out"): pastedRecipe.ts sorts it into the add-by-hand form to
    check (headings, "Serves 4", times, list marks, step numbers,
    hashtags; works without headings too).
  - Paprika imports get the full-size photo from the site when Paprika
    saved the recipe from one (its `image_url`, fetched by the new
    recipe_photo.pb.js), else a full-size one from `photos`, else the
    small preview (the summary says how many only had that).
  - Paprika 4's leftovers tidied: step numbers ("1. Preheat"), list
    marks, `[recipe:…]`/`[photo:…]`/`[text](link)` marks; its number
    minutes count when the text ones say nothing.
  - Export one shelf or your favorites, not just everything (the file is
    named after it, "Bentotachi Soups 2026-11-07").
  - Open a Paprika file with Bentotachi (Files, email, chat: "Import into
    Bentotachi" under Open with or Share): BentoSharePlugin copies it into
    the app's cache, and Import & export asks "Import “…”?" first. Android
    has no type for Paprika files, so the app offers itself for zip and
    "any file" types (the import says if it isn't one). Needs the next APK.
    Tried on Xel's Pixel with the test build: Open with and Share, from a
    fresh install through first-time setup, and with the app open.
- Nutrition facts (Xel, 2026-11-07; most recipe apps keep them):
  imported from a website's recipe data (recipe_parse.js nutritionLines:
  per serving, in label order, bare numbers given their unit) and from
  Paprika files (both ways), stored on every recipe (migration
  recipes_nutrition, a list of lines). Shown only to people who turn on
  "Show nutrition" in the ⋮ menu (users.show_nutrition, off by default,
  as some would rather not see it): a label-like card after the notes,
  editable there, with "+ Add nutrition" on recipes without. Recipes
  imported before this have none; re-saving them from their link would.
  Looked at and left out: the recipe's author (the card already says
  the site), keywords (mostly search-engine filler), videos and
  equipment (few sites give them).
- Timer buttons sit inside their step's card, under its text.
- The recipe page has an Ingredients · Method · Notes switch (Xel,
  2026-11-07, like Paprika's tabs but on one page): it sits above the
  ingredients and sticks under the top bar; each section remembers where
  you were, so step 5 → ingredients → Method lands back on step 5
  (recipeJump.ts, RecipeJumpBar.tsx).
- Imports join an amount listed apart from its ingredient ("1
  tablespoon" + "olive oil", as The Kitchn's recipe data has it;
  recipe_parse.js joinAmounts). Two household recipes imported from
  there on 2026-10-30 still have split lines and need fixing once.
- Paprika files carry more across (Xel, 2026-11-07): a recipe's rating
  and favorite (Paprika's are the person's own) become the importing
  person's onigiri and heart, and the export writes the exporter's hearts
  as favorites (its rating is still the household's average). Where a
  recipe is from when that isn't a link (a cookbook, "Nan's card"), its
  difficulty and its nutrition go into its notes rather than being lost.
  Not carried: Paprika's extra photos (Bentotachi keeps one), a photo
  only given as a web address, and the date it was added.
  Paprika itself refused Bentotachi's exports ("invalid recipe uid":
  it wants UUIDs, and stops the whole file at one other id). Each
  recipe's uid is now its id in UUID shape (paprikaUid), and the import
  still recognises its own recipes coming back, from old files too.
  Checked in Paprika on Xel's phone: the household's export imported,
  with photos, links, categories, times and ingredients.
- Paprika import and export cope with big collections (stress test
  2026-11-07, made-up exports of 1000 and 3000 recipes, a third with
  photos): the import unpacks and saves one recipe at a time and the
  export writes its zip as it goes (its own small stored-zip writer,
  checked with Python's zipfile), so on the Pixel a 1000-recipe, 165 MB
  import peaked at 528 MB instead of 1.46 GB and gave it all back after;
  the export 593 MB instead of 770, with the save screen up in seconds.
  Over-long recipes are trimmed to what the database keeps instead of
  failing; a same-named recipe is only "already here" with the same link
  or the same ingredients (two different "Pancakes" both come in); the
  summary names up to five skipped or failed recipes; an empty file says
  so. Round trip checked: 1013/1013 recipes, every photo byte for byte.
  After review: Bentotachi's own export comes back as "already here"
  even when it reworded lines (formatting, "##", "Day 1:") or by its id;
  a damaged entry counts as unreadable instead of stopping the import;
  photos are decoded only for recipes being added and the file is
  unpacked a few MB at a time (a 3000-recipe re-import 5.6 s instead of
  26, the screen updating throughout); shortened recipes and photos an
  export couldn't fetch are named; a strict zip test guards the writer.
- Ratings are onigiri now (Xel, 2026-11-07): the household rates with
  five onigiri (OnigiriIcon, drawn for Bentotachi; still stored as
  `stars`), and a website's own rating, saved when a recipe is imported
  from a link (migration recipes_site_rating, recipe_parse.js siteRating
  from the page's aggregateRating), shows as grey ★: on a card until the
  household rates it, and on the recipe page as "★ 4.8 from 2,341
  ratings on taste.com.au". Every card also says where it's from (its
  site, or "home recipe"), so a recipe is easy to find without opening
  several (card version C from the mockups). Recipes imported before
  this have no site rating; Paprika files carry none (their rating is the
  person's own). "Top rated" still sorts by the household's.
- Recipes with the same name (Xel, 2026-11-07): their cards, and the
  plan's recipe chooser, add a small line telling them apart, the site
  each came from or the day it was added (recipeTwins.ts), and an import
  that brings in a different recipe under a name already here says so.
  Not built: a "keep both / skip / replace mine" choice per clash during
  import, until a tester needs to update recipes that way.
- The top bar's + is a plum book-with-a-plus that always adds a recipe
  (Xel, 2026-11-07); it used to add to the page you were on, but Pantry
  and the shopping list have their own add box at the top, now joined to
  its button (the outline wraps both). Pantry's stock level is slimmer and
  sits closer to the edge; an opened pantry item has its name and a ✕ at
  the top, and its buttons stay on screen while scrolling.

Released in 1.17.0 (2026-11-07, deployed the same day):

- Tidying recipes and shelves, one system (Xel, 2026-11-06; seen in the
  store screenshots): browse by default, change a recipe on its own page,
  tidy the collection in one Edit mode.
  - The top bar's bin is gone. "Edit" beside "One list" on the Recipes page
    opens Edit mode: tap cards to pick them (a plum tick and outline), and
    a bar above the tabs offers "Put on a shelf" (tap a shelf to put them
    all on it, or a highlighted one to take them off) and "Delete" (one
    question for all of them, saying what else goes). Done ends it.
  - Shelves show their drag grips and "Edit shelf" only in Edit mode, with
    "+ New shelf" at the end; the empty shelves' names open them. The
    Shelves page (was "Categories", now #/shelves) lost its ↑ ↓: moving
    shelves is dragging, in one place.
  - "Delete recipe" at the end of each recipe's page (there was none).
  - One word, "shelves", everywhere: "Make shelves", "Shelves start
    closed" in the ⋮ menu.
- The fridge door's way in is a little sticky note stuck to the end of the
  title (Xel, 2026-11-06): soft jade paper, tilted, held by a wooden
  magnet, with scribbles on it, or the number of new notes in plum. It
  replaced a note icon in its own box that looked like a separate button.
- A recipe page's details in one card (2026-11-06; looked sloppy in the
  store screenshots): the description, a line, then servings and times in
  even columns, then "⏱ Time it" (a running timer stays inside it), with
  the ✎ for all of those in the card's corner. Tags and their "+" are the
  same height.
- Ratings and "when we had it" in one card under the tags (2026-11-06):
  stars and thumbs, the average with a pill per person that now shows
  their name ("Alex ★4", "You ★5"; no pills when one person uses
  Bentotachi), a line, then "Last had Mon, Nov 2 / 4 days ago / Next: …"
  (or "Not cooked yet") beside "We cooked this", laid out the same way
  however much there is to say.
- The dinner plan's tidy-up (2026-11-06): the "how to drag" hint moved
  from the top to one short line after the plan, "Shop for these" moved
  there too as a full-width "Add these to the shopping list" (like the
  one under a recipe's ingredients), and with breakfasts and lunches on,
  a day's empty meals are small "+ Breakfast  + Lunch" chips after the
  planned ones (still drop targets) instead of a full dashed box each.
  The two weeks are named (Xel's pick from three mockups): "This week" /
  "Next week" headings in the list ("Last week", "Week of Nov 16" once
  you move), so the list's top has just ‹ Today ›, centred (the month view
  keeps "November 2026"); and the list opens at today with yesterday just
  above it (so does "Today"), instead of at Monday. Since 2026-11-08 the
  list starts at yesterday instead (today second, the page at its top,
  week headings where weeks start): scrolled to today late in the week, it
  looked like the bottom of the page to a tester (Xel chose this). Also
  since then, the top bar's Add recipe shows only on Recipes and Browse (a
  tester expected it to add a pantry item on Pantry). Also since then a
  meal can hold more than one recipe (a side with the main; Lilly): "+ Add
  another" under it, the recipe page's Plan adds alongside instead of
  replacing, and a lone dish dragged onto a lone dish still swaps
  (migration 1764806400; older apps show one per meal). A planned meal is one
  bordered card with its drag handle as a slim soft-jade tab down the left
  edge (Xel's pick of two mockups), so it's clearly what moves it.
- Shopping list (2026-11-06): tighter rows (about 46px instead of 60,
  still a full-width tap target), and "for Crispy fish tacos" under an
  item is quieter (smaller, grey, underlined only when pointed at), so the
  groceries stand out and more of the list fits on screen in the shop.
- Page titles ("Dinner plan", "Shopping list", "Pantry", "The fridge
  door"…) are in Pond Pebbles, The Koi Pond's own font (Xel, 2026-11-06;
  VISION.md). A recipe's own name stays in the phone's font: the font has
  no accented letters (it does have straight apostrophes and quotes).
- The fridge door looks like one (Xel's pick, 2026-11-06): notes are paper
  in soft jade, plum or peach (kept per note), two to a row (filled left
  to right, newest first), each tilted
  a little and held by a magnet in the colour of whoever left it (wood
  when it's just you). "Lately" is a calm feed: no bullets or underlines,
  names in their colour, recipe names in bold, the plan and "Run out" in
  plum. No notes yet: the message sits in a dashed outline.
- The servings changer above the ingredients is a small card (Xel's pick
  of two mockups, 2026-11-06): "Makes" with − 6 + beside it, then once
  changed one line, "Scaled from 4. Amounts in the method stay as
  written. Reset". It was a bare "6", a floating "Back to 4" and a
  two-line note.
- An ingredient's pantry status is quiet now (2026-11-06; the outlined
  chips of different widths looked sloppy, then loud): the pantry's level
  bars and the word in small grey, no outline, all lined up; only Out is
  in colour. A guessed link has a dotted line under the word (it was a
  dotted outline).
- Recipe shelves and pantry places are drawers (Xel's pick of three
  mockups, 2026-11-06): one bordered card whose front is tinted soft jade,
  holding the ⌄, name, count (and in Edit mode the grip and "Edit
  shelf"), with the contents under a line, so closed ones stack like a
  chest of drawers instead of headings floating above their cards.
- Pantry (2026-11-06): places (Cupboard, Fridge…) start open and the ones
  you close stay closed on that device (they all started closed on every
  visit, so the page opened looking empty); "In stock:" packets that wrap
  onto a second line now line up under the first one, not under the
  label.
- Edit mode after review (2026-11-07): putting recipes on a shelf or
  taking them off reads their tags fresh (a housemate's change isn't
  saved over), offers Undo, and says when they also left another shelf
  that shares a tag; failures name the recipes and only those stay
  picked. Empty shelves are shut drawers with grips in Edit mode, so
  they can be moved (the Shelves page no longer lists shelves; it opens
  one). Delete asks once even on a double tap, and names the recipes.
- Padding pass (2026-11-06): grey intro lines no longer get the
  browser's 1em margin on top of the stack's gap (33px around them on
  Browse, Add recipe, Shelves, Backups), cards are 16px inside instead
  of 20px, and a shelf card's Edit sits beside its name instead of on a
  row of its own. Browse's "+ Add a site" is on the "Our sites"
  heading's row (it looked like it belonged to "Recipe sites" below).
- Pond Pebbles has opening quotes now (‘ “, the closing ones turned
  round), instead of showing the closing shape at both ends: copied in
  from the website repository's rebuilt font (2026-11-06).
- Buttons on their own at a card's or list's end sit at the right, like
  Save (Xel, 2026-11-06): "Stick it on the fridge", Backups' "Join a
  household", Browse's "+ Add a site", Edit mode's "+ New shelf" and the
  Shelves page's Edit had drifted left. Delete, Stop and Reset stay on
  the far left on purpose (the 2026-11-02 rule), away from Save.
- "⏱ Time it" is the recipe details card's footer: below a line, "How
  long does it really take?" on the left and an outlined button at the
  right, where the running timer then takes over. Its Stop is outlined
  like Pause, and both have a symbol (■ Stop, ⏸ Pause, ▶ Resume).
- Recipe cards: the ⚡ moved off the photo into the line under the name
  ("⚡ 15 min" in jade), so it can't be mistaken for a button; same on the
  recipe page's Total. Only your favourites wear a heart, as a small
  badge in the photo's corner (Xel, 2026-11-06): no more row of empty
  heart buttons; favouriting is on the recipe's own page.
- A first-time look (2026-11-05), as a new household would see it:
  - Recipes: empty shelves fold into one line after the filled ones
    ("Empty shelves: Sides · Desserts… To put a recipe on one, edit it and
    tap the shelf under Tags"; Xel's pick), so a new household's first
    recipes come first instead of under seven empty drawers. No bin in the
    top bar while there are no recipes to delete.
  - A recipe page's title gets its own line on a phone, with Plan, Edit
    and Share under it (it was squeezed beside them).
  - A recipe's photo in its form: "Take a photo" (phones) and "Choose a
    photo" buttons with a preview, like the pantry's, instead of the
    browser's bare file box; "Our notes" and Photo marked optional.
  - The plan: the drag hint and "Shop for these" wait until something is
    planned (from today on, for the latter). The dinner chooser with no
    recipes yet hides its search and filters and says a note will do for
    now; the note box says "Write a note".
  - Shopping list: Ben with his halo on the empty list ("Nothing to buy,
    for once…"). Browse: a line under the empty "Our sites". Add recipe:
    the saved-page import says it's for a computer (⌘S on a Mac).
  - The tab bar lights no tab on the ⋮ menu's pages (Household, Profile,
    Backups, Import & export); Recipes was lit there.

Released in 1.16.0 (2026-11-05, deployed the same day):

- Packets in stock (2026-11-05; new `pantry_packets` collection and
  `barcode_details` on pantry items, migration pantry_packets): Detailed
  rows show "In stock: White Mill 1 kg ✕ · Coles 2 kg ✕", and tapping one
  finishes it, with Undo. Finishing the last one makes the item Out and asks
  about the shopping list. Out clears an item's packets (on the server, so
  older apps do too; pantry.pb.js), and its message has Undo, which puts
  them back. The edit form has "Packets in stock" (+ Add a packet, brand
  starting as the favourite; these save straight away). Scanning something
  already in the pantry offers "+ Add this packet": brand and size come
  from what the item remembers for that barcode, else Open Food Facts
  (asked once, then remembered). "Brands we buy" is now "Favourite brand";
  items listing several offer buttons to pick one, never picked for you,
  and a scanned other brand no longer joins it (its barcode remembers its
  brand instead). Simple rows don't show packets. A server from before
  this has no packets, and the pantry works as before there. Checked in
  pantryPackets.test.ts, packets.check.mjs, and in Chromium on a copy of
  the Pi's backup (finish with Undo, last one, Out and Undo, the form,
  a typed barcode).
- From its review (review-for-xel, 2026-11-05): picking Have or Low while
  Out's Undo is showing counts as that Undo (the packets come back); Undo
  waits for the Out to reach the server; the Undo-only message goes by
  itself once the item is on the list; a packet on an item already Out can
  be finished; Enter can't add a packet twice; Open Food Facts brands are
  cut to 120 characters.
- The household's pantry tidied the same day (one-off, not in the app):
  plain names, brand spellings, one "Sauces & condiments" shelf, and 12
  duplicates merged into items with a packet per brand (144 items to 131).
  A backup from just before is on the Pi and this PC
  (before_pantry_tidy_20261105.zip).

Released in 1.15.0 (2026-11-04, deployed the same day):

- The fridge door (decided and built 2026-11-04): the title in the top bar
  opens it, with a note icon beside it counting notes someone else left
  since this phone last looked (fridgeSeen.ts; no buzzing phones, which
  would need a company notification service). A random splash line at the
  top; notes anyone in the household leaves for everyone (new `notes`
  collection, migration 1764288000; "Done" takes one down, with Undo); and
  "Lately": how much of the next 7 days is planned, what's run out, and
  recipes added or cooked this week, with who. On your own (phone-only, or
  the only account) it's notes to yourself, without "Lately". Rules in
  fridgeDoor.ts (tested), checked end to end by notes.check.mjs.
- The tagline "Because dinner insists on happening every day." replaces
  "Recipes · Plan · Pantry · Together" on the first screen (docs/VISION.md).

Released in 1.14.0 (2026-11-04, deployed the same day):

- New colours: umeboshi plum and tea-rice instead of orange and cream,
  with wooden chopsticks (docs/VISION.md).
- Closing the barcode scanner with Back no longer says "The scanner isn't
  ready yet" (BentoScannerPlugin.java: Android app only).
- Phone-only mode: no username or password on Profile; Backups keeps the
  login behind "Here's your login".
- Phone-only mode's own server gets the two fixes already live on the Pi:
  shops' "Image coming soon" pictures aren't saved as pantry photos, and
  "400 g e" reads "400 g".
- A recipe saved in Bentotachi's browser is no longer lost when Android
  closed the app in the background meanwhile: it's imported when Bentotachi
  starts again.
- Swapping two meals on the plan can't lose one any more (also live in the
  browser version once deployed).
- Browse keeps your last search (until you clear it with ✕), so after
  saving a recipe you can go back and look for more.
- A new app first asks "How will you use Bentotachi?": "Just me, on this
  phone" or "With my household", as two equal choices (a housemate took the
  phone-only form for the way in, 2026-11-04). Phone-only mode's ⋮ menu has
  "Join a household" where Log out would be (it was only at the bottom of
  Backups).

Released in 1.13.0 (2026-11-02; deployed with its server changes the same
day, commit 993a485):

- Pantry photos (2026-11-02; the phones need the new APK for the
  buttons): an item with a barcode or a store link gets the product's photo
  by itself: Open Food Facts' front photo for its barcode first, else the
  store page's photo (Coles and Woolworths both checked), including items
  added before photos existed. In an item's form: Take a photo (on phones;
  Android's camera through Capacitor's file chooser, no new permission),
  Choose a photo, Find its photo online, No photo. Photos are shrunk to
  600 pixels before sending; the list shows a 40-pixel copy. Each set of
  barcodes and links is tried once (`photo_link_tried`); adding a barcode
  or changing a link tries again. A photo someone removed stays removed
  for good, on every phone, whatever barcodes or links come later (Xel,
  2026-11-02; only "Find its photo online" brings one back). If Open Food
  Facts or a store can't be reached, it's tried again next time. Server: pantry_photo.pb.js (route `/api/cookbook/pantry-photo`)
  and the pantry_photo migration; checked in pantry-photo.check.mjs,
  page_image.test.js and barcode_lookup.test.js, and in Chromium and
  Firefox. Not tried on a real phone yet (the camera).
- Several store links per item (2026-11-02), say a Coles one and a
  Woolworths one, up to 5: "+ Another store" in the item's form, a ✕ on
  each, and "Find on Coles" replaces the item's Coles link if it has one.
  Pantry rows and the shopping list show each store's logo. Stored as
  `store_url` (the first) plus `more_store_urls` (the rest; migration
  pantry_more_store_links), so 1.12.1 and older still show and edit the
  first link and leave the others alone (checked in
  pantry-photo.check.mjs). Photos are looked for on each link in turn.
  Checked in pantryItem.test.ts and in Chromium (wide and phone width).
- Pantry rows redesigned (2026-11-02, Xel's picks in the pantry card
  playground): every row keeps a 36-pixel photo spot so names line up; the
  brand sits small under the name; expiry is a badge beside the name
  ("Tomorrow", "Expired"; the full wording in its label); Opened and the
  store logos share one line, lined up with the name. Have / Low / Out is
  now a level (three bars) with the word, which opens a dropdown (a real
  one, see-through over the level). Running out no longer puts things on
  the shopping list by itself: the app asks "Put it on the shopping list?"
  (Add it / Not now). The server still adds it for older apps, which
  don't ask; newer ones send `ask_about_list` (pantry.pb.js; checked in
  pantry-rules.check.mjs). PantryRow.tsx; checked in Chromium at phone
  width, light and dark.
- Pantry.tsx split up (no change to what it does): PantryRow, PantryForms
  and PantryScan are their own files; the sorting rules are in
  pantryGroups.ts and the form fields' in pantryFields.ts, both tested.
- The whole pantry page redesigned (2026-11-02, Xel's picks in the pantry
  page playground, after a designer's pass):
  - Simple / Detailed switch beside the title (like the shopping list's),
    remembered per person on each device; everyone starts in Simple.
    Simple: one line, name + level, expiry only when soon or past.
    Detailed: 44-pixel photo (or a letter tile), "brand · note", then
    Opened and the store logos.
  - A find-or-add box replaces Barcode / Search stores / + Add item: typing
    filters by name or brand; Add opens the form with that name; a barcode
    number (typed, or a USB scanner's) is looked up like a scan; Scan sits
    in the box on phones. Store search is the add form's store link
    buttons now.
  - One card per place, subcategories as small headings inside; one soft
    "3 to check" per place instead of separate badges; Open / Close all as
    an arrow after the filters.
  - The shopping list as an icon beside the level (a dashed "+ cart"
    button when low or out and not on it); Have is quiet.
  - The top bar's + adds to the page you're on: a pantry item on the
    pantry, the shopping list's box there, a recipe elsewhere.
  Checked in Chromium at phone width, light and dark; matchesSearch and
  needsChecking in pantryGroups.test.ts.
- From the 2026-11-01 bug hunt (server only, so live once deployed; no
  APK needed):
  - Importing no longer fails on an over-long field: title, description,
    servings, author notes and the lists are cut to what the database keeps
    (recipe_parse.js fitRecipe; server/test/import-limits.check.mjs, which
    failed on the old code). A photo over 10 MB is skipped, its type comes
    from the file itself rather than the site's label, and if the save
    still fails with the photo, the recipe is saved without it.
  - Ticking off more of something you still have (Have or Low) keeps its
    expiry date; only an item that had run out gets its old date cleared
    (pantry.pb.js; checked in pantry-rules.check.mjs).

Released in 1.12.1 (2026-11-02; deployed with its server changes the same
day):

- Fixes from the 1.12.0 review (commits d2efa52 to afe3f42, each re-checked
  by a fresh reviewer):
  - Scaling: "½ cup + 2 tbsp", "1 cup plus 2 tablespoons (255 g)",
    "1 tbsp and 1 tsp" and ", plus 2 tbsp" scale every amount; "Juice of 1
    large lemon" / "zest of 2 limes" scale too, with the fruit's plural and
    the amounts around them ("3 tbsp oil and juice of 1 lemon").
  - Dutch thousands with a dot ("1.000 g bloem") are a thousand for grams
    and millilitres; "1.250 kg" stays one and a quarter.
  - Offline shopping list: changes made while it was sending aren't lost;
    taps on items with a change on its way wait a moment; the login is
    checked fresh before sending, so an expired one keeps the changes (you
    log in again and they go) instead of losing them (server/test/
    expired-login.check.mjs shows why: PocketBase answers an expired login
    with 400/404, as if the change were refused). One send at a time for
    the whole app (leaving and reopening the page mid-send no longer adds
    things twice), and "Clear ticked" handles things added offline.
  - Every list (and the recipe list) checks the login before loading, so
    an expired login shows the login screen instead of empty lists that
    would replace the phone's saved copies.
  - Release and deploy run both test suites first; release stops without
    the signing key's file (unless --test-key); deploy won't wipe a Pi
    folder that's missing here, packs everything before sending anything
    (a locked file stops it), and only sends committed server code.
  - Test servers run with --automigrate=false, after a review's test
    server left a migration file that would have made logins last 10
    seconds (removed; it was never committed).

Released in 1.12.0 (2026-11-02; the Pi's data was copied to
`~/bento/pb_data-before-2026-11-01T17-02-36.tar.gz` on the Pi first, for the
meals database change). Try on a phone: the share sheet, the timer buzz,
picking a Paprika file to import.

- From the review (docs/REVIEW.md), the small things:
  - "Added by" and "Cooked by" always name whoever is logged in
    (server/pb_hooks/who_added.pb.js; checked by test/who-added.check.mjs),
    so a member can't put something under someone else's name.
  - Past nights on the plan are no longer faded to 55%: the day's name goes
    grey and photos fade, the dinner's name stays readable.
  - Emoji at the start of buttons ("📷 Scan", "🎲 Surprise me", ✓, ♡) are
    hidden from screen readers, which read them out by name.
  - The friends' Start Bento.bat no longer says "send it to Claude".
- Scaling a recipe: "− 4 servings +" above the ingredients changes every
  amount (web/src/scaling.ts, tested in test/scaling.test.ts), with the
  weight, spoon and cup hints worked out for the new amount; "Makes" and
  "Add to shopping list" follow it. Big batches step by a quarter ("24
  cookies" by 6); recipes that don't say how many they make step ×½ to ×4.
  It goes back to the recipe's own size when you leave. Sizes after a count
  ("1 (400 g) can") and amounts in the method aren't changed, and the page
  says so.
- Breakfast and lunch on the plan (needs a server restart: new `meal` field
  on meal_plan, unique per day and meal instead of per day, and
  `plan_meals` on household_settings). Household → "Meals on the plan"
  turns them on; until then the plan is the same dinner plan as before.
  With more than dinner, each day lists its meals with small labels, the
  page is "Meal plan", meals drag between days and meals (a lunch can
  become tomorrow's dinner), the month grid shows the dinner's picture with
  "+1", and the recipe page's Plan button asks which meal. Apps from before
  this (1.11.0) still work: what they plan is a dinner (meal_plan.pb.js),
  though they'd only show one meal a day. Checked by
  server/test/meals.check.mjs and in Chromium and Firefox.
- The shopping list by aisle (web/src/aisles.ts, test/aisles.test.ts): Fruit
  & veg first, Frozen and Household last, each with a small heading in the
  one card; "As added" switches back (remembered on the device). Things
  linked to the pantry go where it keeps them; others are guessed from
  English words ("coconut milk" is a tin, "frozen peas" frozen), and
  anything else is under Other. Typing "milk" when Milk is waiting says
  it's already on the list; when it's ticked, it comes back instead.
- Timers in the method (web/src/stepTimers.ts, test/stepTimers.test.ts):
  a step that says "cook for 5-8 minutes" or "1 hour 30 minutes" gets a
  "⏱" button under it for each time (a range counts down from its shorter
  end). Running timers sit in a tray above the tab bar on every page
  (StepTimerTray.tsx), with pause and ✕, and carry on after leaving the
  page or reloading; at zero they say Done!, beep and buzz (new VIBRATE
  permission in the Android app, so the buzz needs the next APK). A locked
  phone doesn't run the app, so the beep comes when it's opened again;
  ⋮ → Keep screen on avoids that.
  Since 2026-11-08 (a tester's report; Xel: build it): in the Android app a
  running timer also has a notification waiting with Android
  (web/src/timerAlerts.ts, @capacitor/local-notifications), which rings at
  zero with the phone locked or Bentotachi in the background, and opens
  the recipe when tapped. The first timer asks for notifications, then
  once for "Alarms & reminders" (Android 14+ doesn't give it by itself);
  without that one it rings roughly on time (Android held a 6-minute
  timer's back by up to 4 minutes on the emulator), and the tray beeps at
  zero while the app is on screen. Tested on an Android 16 emulator:
  locked-phone ring, pause and stop taking it back, and turning the
  permission off mid-timer (which restarts the app). Needs the next APK.
- The plan's weeks start on Sunday for US households (list and month).
- Dutch amounts (test/dutch.test.ts): "1,5 kg" (a decimal comma, kept when
  scaling), dl and cl, el and tl (eetlepel, theelepel), and 15 ml spoons
  for Dutch and Belgian sites. "1,000 g" is now read as a thousand (it was
  read as 000 g before, giving no hint).
- Share a recipe (the share button beside its title): the name, servings
  and times, ingredients at the size it's scaled to, the numbered method
  and where it's from, as text (web/src/recipeText.ts). In the app it opens
  Android's share sheet (new BentoShare.send, so it needs the next APK; try
  it on the phone); in a browser its own share sheet, or it's copied.
  Print (browsers, not on phone-width screens) prints just the recipe. On
  a very narrow phone, Plan, Edit and Share move under the title.
- Import recipes from a Paprika file: ⋮ → "Import & export" (was "Export
  recipes"). Reads .paprikarecipes from Paprika, Mealie, Tandoor or Bento
  (web/src/paprikaImport.ts, test/paprikaImport.test.ts), with photos up
  to 10 MB; "Sauce:" lines become headings, times become minutes,
  categories tags; recipes already here (same name and link) are skipped.
  Tried in Chromium and Firefox with a made-up file; try a real Paprika
  export, and the phone's file picker.

Released in 1.11.0 (2026-11-02):

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
- ⋮ → Export recipes: every recipe with its photo as one Paprika file
  (`.paprikarecipes`, which Paprika, Mealie and Tandoor import). Uses
  fflate (zip library). In the app it saves through Android's "save as"
  screen (new BentoFilesPlugin; needs the next APK, and trying on a phone).
- Phone-only first (decided 2026-10-31, see docs/REVIEW.md): a new app
  opens on "Bento on this phone" (just a name), with "Connect to a server"
  under it; phones that can't run it (not 64-bit ARM) go straight to the
  server. An unreachable server address now says so. Profile → Delete my
  account (phone-only: Delete everything). Backup nudge on the Recipes page
  and "Last saved" on Backups. "Save my data" when the phone's server won't
  start (Go `Rescue`). The phone account's password is saved before setup.
  Android's own backup to Google is off (`allowBackup="false"`). Privacy
  policy updated for all of this (live once pushed). All needs the next
  APK and a real-phone test.
- Renamed **Bentotachi** (decided 2026-11-01: plain "Bento" is crowded,
  with a "Bento Box" meal planner on Google Play and the BentoBox restaurant
  platform). Everything people see says Bentotachi: the app's name on the
  phone, screens and messages, the website and privacy policy. The new
  drawn title (branding/make_svg_title.py) is an SVG, light and dark. The
  app ID `com.xel.bento`, saved settings, the Pi service, code names and the
  friends' server package (Start Bento.bat, its guide) keep "Bento".
- The new mascot (2026-11-01): the screaming onigiri, now skewered on
  orange chopsticks instead of the leaves and sakura (friends found two
  flowers too much next to the title). It's an SVG on the login screen and
  website, and the new app icon and launch screen (branding/README.md).
- Ben's moods (the onigiri, docs/VISION.md): holding his chopsticks on
  "No recipes yet", sweating at an empty pantry, screaming by an import
  error, bitten in Profile's delete section, and a halo by "Backup saved."
- Jade, the second accent (docs/VISION.md): the title's leaf is jade with
  baran ridges, tags are jade (selected ones solid jade), and success
  messages like "Saved." are jade instead of green. An umeboshi (the
  onigiri's pickled plum, with a puddle of juice) replaces the title's sakura.
- Phone-only backups are suggested as `bentotachi-backup-<date>-<time>.zip`
  in the phone's own time (the phone's server runs on UTC, so the old
  `bento-…` name could be a day off). Phone-only mode was tested on a real
  phone (2026-11-01, see docs/REVIEW.md).

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
  Since 2026-11-07 also British words both countries say differently
  (aubergine, courgette, mangetout, Chinese leaf, cling film…), about 30
  more pairs (Swiss brown/cremini, wombok/napa cabbage, eye fillet/beef
  tenderloin, baking/parchment paper…), spellings that link and search
  alike without a hint (yoghurt/yogurt, chilli/chili, filo/phyllo), and
  accents and hyphens no longer matter anywhere names are matched
  ("jalapeno" finds "jalapeños"). Hints follow plurals ("2 aubergines
  (eggplants)"). Still left out on purpose: "shallots" (spring onions in
  much of NSW), "tomato purée", "pawpaw", "biscuit", "jelly", "pumpkin".
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

## Next up: the pantry listings (Xel, 2026-11-02)

Xel wants to keep working on how pantry items look and what they hold.
More may come; these are the ones so far:

- [x] The row's layout and card composition as a whole (2026-11-02; see
      "Waiting for the next app release").
- [x] Several store links per item (2026-11-02; see "Waiting for the next
      app release").
- [x] The brand kept next to the product name (2026-11-02: small, under
      it). Becomes the favourite brand with "Packets in stock" below.
- [x] A better place for expiry warnings (2026-11-02: a badge beside the
      name).
- [x] Packets in stock (designed 2026-11-02, built 2026-11-05; see
      "Waiting for the next app release"). On the row as
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
      see "Waiting for the next app release"). Next: a `review-for-xel`
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

Next step when Xel wants it: a playground with two or three versions of
the bento export picker (and maybe the hanko stamp), light and dark, at
phone width; and the voice-pass list as its own short document.

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

## Next: buy only what the pantry is short of (Xel, 2026-11-08)

Adding a recipe's ingredients to the shopping list should count what's in
stock. Example: the pantry has 200 g of linguine, the recipe (scaled up)
needs 1.5 kg, so the list gets "1.3 kg linguine", not 1.5 kg. Needs the
pantry's packets to say how much is left (pantry_packets has sizes like
"500 g"; see pantryPackets.ts), the recipe line's amount at its scale
(scaling.ts reads amounts), and units that can be compared (g/kg, ml/l;
"2 onions" against a packet count is harder). Where it can't tell, add the
whole amount as now. Xel: build it next time.

## Next: tell Play users when an update is out (Xel, 2026-11-08)

The Play version has no update banner, because Play forbids an app
installing its own updates (`canSelfUpdate` in appUpdates.ts), so people
wait for Play's background auto-update. Google's own in-app updates
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

## To consider: spelling that follows the household's region (Xel, 2026-11-08)

Text people see is in Australian spelling (colour, favourite, organise),
Xel's choice for their projects. American households could get American
spelling and words instead (color, favorite), following the same household
country that already picks regional ingredient names (regionalNames.ts,
"bell pepper (capsicum)"). Not built: it means keeping the app's text in
one place with both spellings. The app's own text is all Australian
since 2026-11-08 (favourite, colour); code names and stored values
(`favorite`, `color`) stay as they are.

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

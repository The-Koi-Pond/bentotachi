# Releases

What each app release brought, newest first, as written at the time
(moved here from docs/PLAN.md on 2026-11-10, unchanged). What's waiting
for the next release stays in PLAN.md, "Waiting for the next app
release"; when a release goes out, its list moves to the top of this file.
Each release from 1.9.0 on is tagged in git (`v1.23.0`).

Released in 1.29.0 (2026-11-13, deployed the same day):

- Tidier lines on the shopping list (a tester's report): brackets that
  only say how to prepare it or point to a note go, as a ", diced" already
  did ("3 garlic cloves (finely minced)" -> "3 garlic cloves", "(cut into
  0.5cm / 0.2" slices (Note 3))" gone); amounts, swaps and kinds stay
  ("(100 g)", "(1 punnet)", "(or a few handfuls kale)").
- A way back (a tester got stuck on a recipe): every page a step in from a
  tab (a recipe, its editor, Add recipe, the settings pages) has a ‹ in
  the top bar, before the logo. It goes back where you came from, like
  Android's back, or to the page above with nothing to go back to.
- Adding up the same thing (a tester's idea): garlic from two recipes is
  one line, "3 garlic cloves" and "2 garlic cloves" making "5 garlic
  cloves", "1 onion" and "1 large onion" making "2 onions"; grams and
  kilos add up, a cup and grams stay two lines. The plan's "shop for the
  week" adds up the same way (two recipes' "3 carrots" were one "3
  carrots" before). Lines are only what to buy now: no "for …" under
  them; a line from recipes has a small book that shows each recipe's
  share and a link to it. Adding the same recipe again doesn't count it
  twice. (A new `shares` field on list lines; older apps still show
  them, with the first recipe.)

Released in 1.28.0 (2026-11-13, deployed the same day):

- Several shopping lists: the list's title is a menu of lists ("Party · 4
  to buy", "Edit lists…" to make, rename or delete one; the main one
  stays). Adding from a recipe, the plan or the pantry goes to the list
  last open ("To: Party" to change it); something already on another list
  asks before it's added here too, or shows "On Party" in a recipe's or the
  plan's list. The pantry's place menu is the same picker now.
- Easier to read (the design check-up of 2026-11-12): people's names in
  their colour, avatars and rating pills, the unpicked side of the
  two-way switches, "(optional)", dark mode's "Out", the ingredient link
  icon and the other months' days on the plan all meet the 4.5:1 contrast
  floor now, in light and dark; a switch that's off has an outline.
- Kinder to busy hands (the same check-up): ticked ingredients and steps
  stay ticked when you pop over to the shopping list (until "We cooked
  this", or the next day); in the plan's month view a meal's picture is
  picked up with a press and hold, so a swipe scrolls instead of moving
  the dinner; an Undo bar or message waits while your finger or the mouse
  is on it. For screen readers: drags say names and days, not codes;
  "are you sure?" reads its question; Undo bars and messages are read out.
- Easier to tap and to read big (the same check-up): small buttons have a
  44 px area to tap without looking any different, ingredient lines are
  36 px, a pantry row's whole height opens it; with the phone's biggest
  text, recipe names fit (fewer cards a row), the pantry's switch and
  Have / Low / Out stay on screen, and "Cooked it" moves under its
  words instead of squeezing them.
- Clearer words (the same check-up): marking a recipe cooked is "✓ Cooked
  it" on all three of its buttons (it was "We cooked this", "Finished"
  and the timer's "Finished"); the screen stays on by itself while a step
  timer or "Time it" runs; Shopping and Pantry have a "?" saying their
  title is a menu; a place's "2 to check" is now "2 low or due"; Add
  recipe has a title; an empty recipe name says "A recipe needs a name."
- Ingredients higher on a recipe (the same check-up): the box at the top
  keeps what you need before cooking (description, servings and times,
  tags, "Time it"); ratings and "Last had · Cooked it" moved to a box after
  the method; on a phone the photo is shorter, so the first ingredients
  show without scrolling.
- A last polish (the same check-up): screen readers hear an error under a
  form as it appears (a wrong password, a failed save); ticked steps, the
  timer's next stage and the week view's grip are quiet without going
  faint; the hint inside a box reads in dark mode; with the phone's
  biggest text, step numbers, the plan's day names and the ‹ › − + buttons
  grow, and the recipe chooser's buttons wrap; the pantry card lost its
  side stripe.
- Moving without dragging: a tap on the ⠿ (or Enter; dragging still
  works) opens a small menu. Shelves (in Edit) and pantry places: "Move
  up", "Move down". A dish on the plan's list: "To the day before", "To
  the day after", "Pick a day…", "Take it off the plan" (with Undo); one
  sent past the days shown says where it went. TalkBack reads the ⠿ as a
  button whose hint names the menu.

Released in 1.27.0 (2026-11-12, deployed the same day):

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

Released in 1.26.0 (2026-11-12, deployed the same day):

- From a tester's bug report (2026-11-12; 17 issues checked against the
  code, one serious):
  - Restoring a phone-only backup no longer locks you out. Its account's
    password was random and only ever kept on the phone that made it, so
    after "Delete everything", a reinstall or on a new phone the restore
    asked for a password nobody had seen. Now, when the saved login fails
    and the data has a single account, this phone takes it over with a new
    hidden password (phoneMode.ts takeOverOnlyAccount; the phone server's
    OnlyAccount / SetPassword, through the plugin only). A household's
    backup, with several accounts, still asks which is yours, and "Welcome
    back" now shows that login instead of a dead button.
  - "Delete everything" forgets every Bentotachi setting on the phone too
    (a server address typed once included), so it starts again at "How will
    you use Bentotachi?", and after setting up again opens on Recipes (it
    used to come back to Profile, found in the phone QA of 2026-11-12).
  - A paused step timer's button says "paused", not "running".
  - The login forms say what's missing ("Type your username."), address
    first, instead of the browser quietly putting the cursor in a box; the
    phone's Back on the login steps goes back to the first choice.
  - "Check for updates" with nothing new says "Checked just now: as fresh
    as it gets".
  - A recipe link typed without "https://" works; text that isn't a link
    says so.
  - The built-in browser's Save button says "No recipe here" for a few
    seconds on a page without one (the pop-up was easy to miss).
  - Play fetches the barcode scanner when the app is installed, so the
    first scan isn't "not ready".
  - "+ More details" in the pantry's add form is easier to tap.
  - "Backup saved (2 MB)." with its size, and the Backups page says the file
    isn't locked with a password.
- Photos offline, opt-in (Xel's call, 2026-11-11): Settings → Your data →
  "Keep photos for offline", on this device, off unless turned on; it
  says the rough size first ("about 18 MB", 200 KB a recipe photo), then
  how many are kept and their real size. On, the phone keeps the 600-wide
  copies of every recipe's cover and step photos and the pantry's small
  squares in Cache Storage (photoCache.ts), fetched one at a time over any
  connection when the app opens, comes back to the front (every ten
  minutes at most) and when the server answers again; deleted or replaced
  photos are dropped. Offline (the server known away, or a photo failing),
  cards, the recipe page's photos (as their 600-wide copies), step photos
  and pantry photos show the kept copy (KeptPhotos.tsx), and the Offline
  note no longer says "without photos". Full size (the viewer) still needs
  the server. Turning it off empties the cache at once; logging out too.
  Not offered where Cache Storage doesn't exist (a browser on a plain-http
  address, like the PC's on the Pi) nor in phone-only mode (the photos are
  on the phone already). Checked in the sandbox with the server cut off.
- From a tester's look at Categories (2026-11-12): a category's name
  shows once (the tick list's own heading went) and stays pinned at the
  top while its recipes scroll; on Browse, a site with Categories is one
  whole row again (all of it opens the site, every row's › lines up at the
  end) with the button inside it, just before the ›.
- Servings read as one line: "6 people" is "Serves 6" (not "Makes 6
  people"), "Serves 4-6" no longer reads "Makes Serves 4-6", and "12
  cookies" stays "Makes 12 cookies" (servingsWording, scaling.ts). The
  edit forms' box is "Servings".
- The recipe page's − and + for servings are plum, like the other actions
  (they were meant to be, but base.css's grey won).
- Containers and counts are amounts on the shopping list: running out of
  Ice cream with "1 tub ice cream" already on it uses that row instead of
  adding a second (also punnet, bunch, dozen, carton, sachet; "a dozen
  large eggs" is eggs now), and a new pantry item from "1 tub ice cream"
  is named "Ice cream".
- Undo after renaming or deleting a place keeps "Edit places" open (the
  tap on the Undo bar closed it).
- A link to a page that's gone (error 404 or 410) says "That page isn't
  there any more. Check the link." instead of calling it the site
  refusing Bentotachi (importing, and Categories).

Released in 1.25.0 (2026-11-11, deployed the same day):

- Browse's sites have a "Categories" button (a tester's idea, Xel's call
  2026-11-11): the site's categories as a plain list, read by the server
  from the site's own menu (links to `/category/…`, `/collection(s)/…`,
  `/topic/…`; categories.pb.js), so nobody keeps lists by hand and they
  follow the site's changes. Opening one shows its recipes to tick and add
  at once (the category picker from 1.20.0), or, when it holds categories
  itself (BBC Good Food's "Barbecue"), those. A filter box for long menus;
  Back shows the list again at once, with its filter. Works for RecipeTin
  Eats, BBC Good Food and Just One Cookbook (checked 2026-11-11);
  taste.com.au turns the server away, Tasty and Simply Recipes use other
  kinds of addresses, and BBC Food's category pages list recipes in a way
  Bentotachi can't read yet, so those four (and the sites that block
  imports) have no button. Our own sites get it too; when one's menu can't
  be read, the page offers to open the site instead. Also: reading a big
  page is quicker inside PocketBase (recipe_parse.js steps from tag to tag).
  Possible later: reading a menu's links whatever their addresses (Simply
  Recipes, Serious Eats), and the menu's grouping ("Dietary › Gluten free").
- "Can't reach the server" (the connection indicator's bubble, and the
  error on a page with nothing saved) adds "It goes through Tailscale, so
  check this phone's Tailscale is switched on." when the server's address
  is a Tailscale one (100.64.x to 100.127.x, or a .ts.net name), after the
  household's phones quietly dropped off Tailscale for two days
  (2026-11-11) and the lists just looked stale.
- Works in the no-signal corner: the plan, the pantry (with its packets),
  what was cooked, the fridge door and the recipe shelves are kept on the
  phone too, like recipes and the shopping list, and show (with an
  "Offline" note) when the server can't be reached. The plan's copy
  borrows its recipes from the recipes' copy rather than keeping them
  twice. Offline they're for reading: the plan hides adding, taking off
  and dragging, the fridge hides "Done", shelves can't be edited, and a
  pantry change that can't be sent goes back as it was, with a message.
  "Used anything up?" after cooking never works from the copy (it could
  mark something Out that a housemate just bought more of).
- A server that doesn't answer at all (Tailscale off, a dead corner) no
  longer leaves pages on "Loading…" for minutes: loading the household's
  records with no answer starting within 8 seconds counts as offline, and
  the copy shows (checked in the sandbox: every page in about 8 seconds).
  Saves aren't limited (one the server made but answered late would be
  taken back, like a mistaken Out's packets), except shopping list changes
  (sent again safely) and any save once the server is known to be away.
  Imports, barcode lookups and photo uploads aren't limited either. While
  the server can't be reached, it's checked every half minute, and every
  open list (and an open recipe) reloads by itself when it answers; a page
  showing its copy counts as "can't be reached", so the check starts even
  when an earlier answer said otherwise (before, only the shopping list
  tried again). "Try again" on an Offline note asks the server instead of
  reloading the page.
- A connection indicator beside ⋮, only when something's off: a cloud
  with a line through it when the server can't be reached, with a small
  count of shopping changes waiting to be sent. Tapping it says what's
  going on and when the server last answered ("today at 2:14 pm"), the
  Tailscale reminder for a Tailscale address, the server's address, and
  Try again. Back online with changes still waiting, it points to the
  shopping list, where they're sent. Nothing shows while all's well.
  Checked in the sandbox (phone width, light and dark): shows after 8
  seconds of no answer, Try again brings everything back at once, and on
  its own it's back within the half minute.

Released in 1.24.0 (2026-11-11, deployed the same day; most of it was
deployed 2026-11-10):

- Running out of something already on the shopping list under another
  wording ("300ml milk" from a recipe, for Milk) says "Already on the list
  as “300ml milk”." and links that row to the item, instead of adding a
  second. Only a plain amount and describing words count ("2 L full cream
  milk"); "Milk chocolate" or "garlic bread" never do.
- A recipe saved from a website gets its photos (cover and step photos)
  shrunk like the app's own (1600 px), so a site's big photos don't fill a
  phone or its backups.
- The recipe list updates live, like the other lists: a recipe, rating,
  favourite or shelf a housemate changes shows straight away, and the
  phone's offline copy keeps up (deletes too).
- Live updates come back after the connection drops, or when the app was
  opened with the server unreachable (liveResend.ts; before, they stayed
  off until the app restarted).
- Shopping list offline: an add whose answer was lost (patchy signal) isn't
  added twice, and a tick or untick made meanwhile still goes; two
  browser tabs that were both offline send each change once; "Clear
  ticked" sticks when the signal comes back during its Undo.
- Pantry places: Edit places opens again after its questions; a place
  can't be called "Other" (it's where things with no place go); a
  correction to a label's size moves its barcode to the corrected product.
- Paprika files from Bentotachi keep their other times ("Cool: 7 hr") and
  numbered headings ("Day 1") through a round trip to another Bentotachi.
- Phone-only mode: setup closed halfway asks for the name instead of making
  a nameless account; the display name can't be saved empty; a backup that
  won't open no longer deletes the phone's last backup.
- A settings change made before the settings loaded no longer makes a
  second settings record.
- The built-in browser's unused "Add to pantry" mode is gone (Android
  side too).
- Phone-only mode also runs on older 32-bit phones (a closed-test tester
  asked, 2026-11-11): the phone server is built for 32-bit ARM too, and
  Chromebooks (which run phone apps by translating them, which Go can't
  take) no longer offer it. Not tried on a 32-bit phone yet: the tester
  who asked is the first.
- From the codebase audit (2026-11-10):
  - A public Wi-Fi's sign-in page answering in the server's place counts
    as no connection: the phone keeps its offline copies, and what's added
    or ticked waits to be sent (before, lists looked empty, the copies were
    wiped, and taps "saved" into nothing).
  - Amounts written "1 and 1/2" (or "1 & ½") are read as one and a half
    everywhere: scaling, spoon and gram hints, timers, the shopping list.
  - Phone-only: no hidden nightly backups filling the phone (and old ones
    are tidied away); "Delete everything" also removes a rescue copy and a
    half-finished restore.
  - "Save these times" keeps a website recipe's waiting time; an open
    editor on a recipe keeps what's typed when a tag or photo is saved;
    step timers under different headings ("Sauce", "Pasta") are told apart,
    in the tray and the phone's notification, and start at the right time.
  - The pantry's "X is out" bar and another Undo bar stack instead of one
    hiding the other; "From a recipe" on the shopping list reads Australian
    and UK spoons right; quick taps on the plan's meals all count; a
    half-written fridge note and a typed shelf tag aren't lost.
  - Release and Play uploads also refuse uncommitted Android or phone-server
    code, and run the phone server's tests before building it.
  - A page built to be slow (runs of unclosed tags) no
    longer keeps the server busy for minutes when imported, and list items
    a page leaves unclosed (allowed for `<li>`) are read one by one; the
    recipe list's Shelves / One list switch shows what's on screen and
    keeps the filters; "egg noodles", "toilet rolls", "spring rolls" and
    "cream of tartar" go in their right aisles; a short message always sits
    above the Undo bars, however tall; sheets stay open in `npm run dev`;
    the app's code for servers older than itself is gone (the Pi is the
    only server).

Released in 1.23.0 (2026-11-10, deployed the same day):

- Short messages after a tap ("The scanner isn't ready yet", "already on
  the list", "Moved to the Fridge", a failed delete) show at the bottom
  like Undo, and go by themselves.
- A pantry item's edit form, condensed: photo beside the name (tap to
  change), trays for storage, buying and what's in stock, the rarely needed
  fields under "+ More details".
- An item's quick card, slimmed: "Favourite: Masterfoods 560 g", what's in
  stock, "+ 1 more" and "Another brand" (for one bought because the
  favourite was out; it never replaces the favourite as what "+ 1 more"
  and the shopping list add).
- Scanning a barcode an item already knows adds one by itself when that
  item's stock is counted ("Added one to American mustard: Masterfoods
  560 g." with Undo); items nobody counts still offer "+ Add this one".
- Scanning something new into the pantry also counts the one in hand, with
  the brand and size Open Food Facts gives ("Masterfoods 560 g"), so it's
  in stock from the start.
- The pantry never says "packet" (tins and bottles count too): "+ 1 more",
  "+ Add one", "How many in stock".
- Fix: using something up and then adding a new one kept the old expiry
  date. Running out now clears it (on the server, so every way back into
  stock starts fresh); Undo of Out puts it back.
- Pantry places: tap the Pantry title to show just one place (Fridge,
  Freezer, a new "Chest freezer"…), or all of them; each phone remembers
  its pick. Searching still looks everywhere. "Edit places…" adds,
  renames and deletes places, kept for the whole household (a database
  change, household_pantry_places, adds where they're kept).
- Products we buy: each pantry item remembers the brands and sizes it's
  had, each with its barcodes and store links, in one list in its edit
  form, with a ★ on the favourite (what "+ 1 more" and the shopping list
  add; only a person changes it). The quick card and the In stock tray
  add any of them with one tap, or "+ New…". Scanning a known barcode
  still adds one by itself; on items someone has dated, the message also
  offers "+ Use-by". A database change (pantry_products) fills in each
  item's products from what it knows already: try it on a copy of a real
  backup before deploying (.claude/rules/pi.md). Older app versions keep
  working: what they add or take off is folded into products on the
  server.
- No more "once opened, keep in" place: an item stays in its own place,
  and each label says whether it's opened.
- Bentotachi's own calendar for every date (use-by, opened, the day to
  cook a recipe): the date big with a pencil to type it, the month with a
  list of years and ‹ ›, then the days.
- Pantry labels: each one in stock has its own bought, use-by and opened
  date, listed under the item ("Bon Maman 360 g · opened · expires in 2
  days", or "bought 12 days ago" when it has no use-by);
  tap one to change it, − when it's used up; "+ Add one" takes a use-by
  too. The item's badge and "use soon" follow the soonest label. A
  database change (pantry_packets_dates) moves each item's current date
  and opened state onto its oldest one in stock: try it on a copy of a
  real backup before deploying (.claude/rules/pi.md).
- Fixes from the pantry review: Edit places opens again after its
  questions; "Other" can't be a place's name; correcting a label's size
  moves its barcode along; a settings change before the settings loaded
  no longer makes a second settings record.

Released in 1.22.0 (2026-11-09, deployed the same day):

- Settings → Appearance: light or dark (Auto follows the device), on
  this device.
- Settings → Household: the country, tablespoon and meals on the plan
  moved here; the Household page is just who's in it and adding someone.
- Profile, tidied: picture (tap to change, a small ✕ to remove), display
  name and My colour in one box; username with the password under Logging
  in; Save beside its box; tips behind "?"; Log out a centred button with
  an icon.
- The dinner chooser: recipes first in bento trays, "Or just a note" as a
  tray at the bottom, calmer "Out of" and "Planned", the surprise as a
  plum tray; Surprise me puts an open pick away again.

Released in 1.21.0 (2026-11-09, deployed the same day):

- Bento trays (Xel, 2026-11-09): search boxes and their buttons, the tab
  bar, pantry places and filters, shopping aisles, Browse's sites, recipe
  shelves (the last row filled out with empty compartments) and the plan
  as trays with compartments; a section's heading sits in its tray's rim;
  group labels ("— Dairy —") centred on a faint line; page titles and
  loose lines start where the compartments do.
- The plan: each dish a soft chip with a round picture; drag one onto the
  bin that appears over the tab bar to take it off (with Undo); a quiet +
  beside a meal adds a side; the top says "8 – 21 November" with a Today
  link; the month view is a tray, other months' days faded.
- Surprise me is a little gacha: each roll says something different, rare
  lines turn up now and then, and Ben joins in after a few rolls.
- Tips behind a "?" open as a small pop-up over the page instead of
  pushing everything down.
- The fridge door: a jade door with a handle, the splash line on masking
  tape, each note on paper in its writer's colour, held by a magnet
  (plums, leaves, onigiri, now and then a tiny Ben), old notes fading and
  curling, Done peeling a note off; an empty door says so.
- A short ⋮ menu (your profile, Keep screen on, Settings, an update when
  one is waiting) and a Settings page for the rest; the household and Log
  out moved to Profile; no tip link in the app.
- My colour: any colour from the device's picker, beside the eight.
- The app's own "are you sure?" boxes instead of the browser's; removing a
  pantry item or one of our sites happens at once, with Undo.
- The page scrolls between the top bar and the tab bar, with a slim jade
  scrollbar; the ⋮ menu scrolls itself on short screens; printing a
  recipe prints all of it.
- Shopping list: "Add from a recipe" is a book beside Add.
- Recipe cards without a website leave that line blank instead of saying
  "home recipe".
- Dark mode: Pond Pebbles headings get a dark outline so they read on the
  jade.
- Compact, not airy (Xel, 2026-11-09): smaller text and spacing across
  the app, so a whole shopping list or eight days of the plan fit on one
  screen; the plan adds a second dish with a + beside the last one (no
  "+ Dinner" under every day); a recipe's details, tags, ratings and
  history share one box. "Welcome back" when returning to phone-only
  mode.
- Voice pass (Xel's picks from a list of 56 lines, 2026-11-09): new words
  on empty screens, loading lines and notices ("No recipes yet. Ben's
  ready, though."), and a friendlier offline note on the shopping list
  that says how many changes are waiting to sync.
- Adding to the pantry starts short (Xel, 2026-11-09): only the name and
  where it lives; "+ More details" opens the brand, note, expiry, store
  links and photo (open from the start after a scan or a store page). The
  grouping tip moved behind a "?" beside "Where it lives", so an empty
  pantry isn't a wall of form. Editing an item still shows everything.
- Bento touches: headings in Pond Pebbles, pantry levels as little jars,
  a brush stroke through ticked shopping, a "Cooked" stamp on recipes, a
  drawn bento box for recipes without a photo, and switches with a wooden
  chopstick under the chosen option.
- Fixes: "rice-shaped pasta" (risoni) isn't Rice; the plan's and list's
  shopping sheets read "Parmesan, finely grated (about 50 g)" like the
  recipe page, and wait for packets before Add; the month view moves a
  whole meal, sides too; Paprika imports shrink their photos; a public
  Wi-Fi's sign-in page can't sign anyone out; a new pantry's first add
  form stays while it's being filled in; two quick choices on a recipe
  page (linking two ingredients, putting two photos with steps) no longer
  undo each other.

Released in 1.20.0 (2026-11-08, deployed the same day):

- Buy only what the pantry is short of: adding a recipe's ingredients
  (its page, the plan, the list's "From a recipe") counts the packets in
  stock and adds just the rest; a covered line starts unticked, saying
  "Enough"; an item marked Low still starts ticked.
- Ticking something bought on the shopping list adds a packet like the
  item's usual one (unticking within the hour takes it back); adding one
  by hand soon after asks if it's the same bag.
- Pantry: packets as "− 3 × 400 g +" counters; tapping an item opens a
  quick card (+ 1 packet, Used one, the other levels, Edit everything).
- Kinds of one thing: "A kind of" (Linguine, Penne: kinds of Pasta), kinds
  grouped in the pantry, a recipe asking for one kind counts only that
  kind, "Any pasta will do" for the rest.
- "✓ Finished" at the end of a recipe's method, then "Used anything up?":
  what it used comes off the pantry, and an open packet remembers "about
  100 g left".
- The Edit page's cover photo is made smaller before it's sent, like the
  other photos.
- Websites' ingredient sections ("Marinade", "Sauce") come in with the
  recipe; "Re-import from the website" in a recipe's ⋯ menu.
- "Amounts in the method" (⋮ menu, off unless turned on).
- Australian spelling throughout (favourites, colour), and American
  spelling for households set to the United States.
- Tips behind a "?" (recipe formatting, the plan, Import and Export, the
  tablespoon, filling a shelf).
- A site's category page (a tester's idea, 2026-11-08): pasting
  one, or saving one in the app's browser, lists its recipes to tick and
  add at once, with "More from this page" for the next lot. Their second
  idea, site buttons on Browse with the site's categories in the app, is
  covered for now by the site's own menu in the app's browser (Browse
  opens it there); in-app category lists per site would need keeping up
  as sites change, so they wait for Xel's call.
- The Play version tells people when an update is out: Google Play's own
  in-app update (the banner, then "Restart to update"). It only starts
  working from the release after the one that brings it, since that one
  still arrives through Play's background updates. Hand test on Xel's
  to-do list.

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
  site; blank without one, Xel's call 2026-11-09, after "home recipe"
  turned out to be noise), so a recipe is easy to find without opening
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
  meal can hold more than one recipe (a side with the main; a household member's idea): "+ Add
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

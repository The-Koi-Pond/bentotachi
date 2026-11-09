# Bentotachi: the vision

What Bentotachi is, who it's for, how it talks and looks, and what it won't
become. Check new screens, wording and features against this. It changes
when Xel decides something new: update it then, with the date.

Items marked *(guess)* are first drafts that Xel hasn't confirmed yet.

## What it is

A recipe box, dinner planner, shopping list and pantry for a household,
starring a screaming onigiri. Made by Xel for their own household first,
then shared with friends, and later anyone on Google Play who likes it.

It's **for** households and friend groups who want a free, private recipe
app with some personality, and don't mind it being a bit unhinged.

It's **not for** everyone. Bentotachi doesn't water itself down to appeal
to a general audience (decided 2026-11-01).

## Promises

These don't bend:

- **Free, and staying free.** No subscriptions, no ads, no "premium" tier,
  no paid features. The licence (PolyForm Noncommercial) stops anyone
  selling it either.
- **Your data stays yours.** It lives on your phone, or on a server you or
  someone you know runs. There's no company server in the middle, and the
  developer never sees it.
- **No tracking.** No analytics, no ad networks, no sign-up with anyone.
- **Always takeable.** Backups whenever you like, and a Paprika export to
  move to another app. Bentotachi never holds recipes hostage. (Yummly shut
  down in December 2024 and its users' libraries went with it.)
- **Support is optional** (decided 2026-11-01): a tip link (like Ko-fi) on
  the website and GitHub. Not in the app at all since 2026-11-09 (it was
  only ever in the sideloaded APK, which Xel likely won't hand out): never
  in the Google Play app (Google pulls apps over donation links, and its
  own billing would show Xel's address publicly), never a nag, and it
  never unlocks anything.
- **Honest about AI.** AI helps make Bentotachi (code with Claude, first
  drafts of art with ChatGPT), and "How it's made" says so plainly. The
  artwork is never called hand-drawn. The Koi Pond is a few friends (Xel,
  Deci and Chai); Bentotachi is mostly Xel's, with the others' feedback, and
  the wording keeps room for them.

## Where it runs

- **Android:** phone-only (the default, nothing to set up) or connected to
  a household server.
- **Desktop:** the same app in any desktop browser, connected to a server,
  which can be a PC in the house. Best for big jobs, like importing a pile
  of bookmarked recipes (decided 2026-11-01).
- **The gap:** a phone-only household can't use a desktop browser, as the
  data is only on the phone. The way across is back up on the phone, set
  up a server, and restore there; a guided version is planned.
- **iPhone:** no app planned. The browser version with a server might work
  in Safari, but nobody has tried it. *(guess)*

## Voice

Cheeky and silly wherever it can afford to be, while staying clear.

- **The joke never replaces the information.** Say the thing plainly, then
  be silly next to it: "It even works in the supermarket's no-signal
  corner" (it works offline), "skips the blogger's life story" (it imports
  just the recipe).
- **Serious moments stay plain.** Deleting, losing data, backups, restores,
  passwords and the privacy policy get calm, clear wording and no jokes:
  people need to trust them. *(guess)*
- **Buttons and warnings say what they do** ("Delete everything", "Save a
  backup"), never a pun. *(guess)*
- **Where the cheek goes in the app:** empty screens ("No recipes yet"),
  hints, success messages and small print. *(guess: the app's text is
  plain so far; the website has the voice.)*
- **Running jokes:** the screaming (the mascot, "besides screaming",
  "complaints about the screaming"), and the onigiri being "fine,
  actually". Use them, don't wear them out.
- **No digs at named competitors.** "No subscriptions" says it; naming and
  shaming another app invites trouble, and Play's listing rules forbid it.
- Plain English underneath: short sentences, no jargon, spell things out.
- **Tips live behind a "?"** (decided 2026-11-08): how to use something
  (formatting codes, dragging, what an import carries, "not sure? count
  the teaspoons") opens from a small ? beside what it explains, as a
  little bubble pointing at the ?, over the page rather than pushing it
  down (Xel, 2026-11-09; web/src/Help.tsx). Tapping elsewhere, Escape or
  back closes it. What a box needs, what just happened and a mode's banner
  stay visible.
- **The tagline** (decided 2026-11-04): "Because dinner insists on
  happening every day.", under the title in the app's first screen and on
  the website. A real sentence in normal case. **No eyebrow taglines:** an
  uppercase, letter-spaced list of words with dots between them ("RECIPES •
  PLAN • PANTRY • TOGETHER", which it replaced) is a well-known AI-made
  look (`C:\Projects\TheKoiPond\AI-DESIGN-TELLS.md`).
- **Splash lines** (2026-11-04): the fridge door (the page the title opens)
  shows a random one-liner each visit, from `SPLASH_LINES` in
  `web/src/fridgeDoor.ts`. Pure garnish, so they can be sillier than
  anywhere else; add more freely, one line each.
- **Words** (Xel, 2026-11-09): never "packet" where people read it: the
  pantry counts tins, jars and bottles too. Say it without a container:
  "+ 1 more", "+ Add one", "How many in stock", "the 2 in stock are
  cleared", "400 g of the 500 g one". (The code and database still call
  them packets.)

## Look

**Name and title.** "Bentotachi" (Bento for short; "-tachi" makes it a
group: the bento gang). The title is Xel's drawn lettering, as SVGs:
`branding/make_svg_title.py` makes a light version (brown letters) and a
dark one (cream letters), with an umeboshi by the "B" (the pickled plum
inside an onigiri, with a little puddle of juice), a jade leaf on the "i"
with baran's ridges (the green divider in a bento box), and a wooden
chopstick underline. Together with the mascot it's one bento: the filling,
the divider, the chopsticks, the rice.

**Mascot.** Ben (to us; the app needn't name him), a screaming onigiri
skewered on plain wooden chopsticks, like the waribashi that come with a
takeaway bento (`branding/make_svg_mascot.py`; orange until 2026-11-04,
when the app's colours moved to plum and jade). The scream is
the point. Every part is its
own shape, so moods can change the eyes, add sweat, take a bite out of it.

- **Each detail once.** The umeboshi is in the title, so the mascot doesn't
  get one (friends found the old sakura on both too much).
- **Ben's moods** (`branding/make_ben_moods.py`, built from his own SVG so
  they always match him): sweating at an empty pantry, screaming (>< eyes,
  a grain of rice flying off) by an import error, bitten beside "Delete
  everything", holding his chopsticks on "No recipes yet", and a halo by
  "Backup saved." One or two details each: ChatGPT's mockups had more, and
  less is clearer. He keeps his wooden chopsticks in every mood. Big (120
  px) on empty screens, small (72 px) beside a message. The words beside
  him still carry the information.
- Detailed versions where there's room, simple ones where it's small (the
  app icon, next to the title).

**Colours** (the app's own, in `web/src/styles.css`; light and dark):

| | Light | Dark |
|---|---|---|
| Background | #F3F6F4 "tea-rice" | #141B1B "pond at night" |
| Cards | #FFFFFF | #202928 |
| Text | #2B2420 | #F1EBE5 |
| Quiet text | #5F6B67 | #A9B3AE |
| Accent (buttons, links) | #A82D4A umeboshi | #EE7D92 |
| Soft accent (icon background) | #F4E4E7 | #33282C |
| Danger (errors, delete) | #B3261E | #FF8A65 (kept apart from the pink accent) |
| Logo chopsticks (waribashi wood) | #A87A43 (clear on both) | #A87A43 |
| Jade, the second accent (the leaf) | #5A9A8A | #5A9A8A |
| Jade tags, website note | #E2EFEB soft jade | #1D3330 |
| Jade selected tag | #3F7668, white text | #7FBFAE, dark text |
| Jade text ("Saved.") | #3A7062 | #8FD3C1 |

**Umeboshi and jade** (jade decided 2026-11-01: teal is Xel's favourite;
umeboshi replaced orange on 2026-11-04). Cream with a terracotta orange
had become the look people recognise as AI-made ("the Claude look", see
`C:\Projects\TheKoiPond\AI-DESIGN-TELLS.md`), so the background became a
near-white "tea-rice" and the accent the pickled plum by the title's "B"
(chosen side by side in `C:\Projects\TheKoiPond\AI-DESIGN-TELLS-colours.html`).
Umeboshi is for doing things: buttons, links, the selected thing. Ben's
chopsticks became plain wood the same day (compared in
`C:\Projects\TheKoiPond\AI-DESIGN-TELLS-ben-chopsticks.html`), so plum and
jade are the only bold colours. Jade is for labels and good
news: tags, success messages, the website's note, the title's leaf. Add
jade where it can afford to, not on buttons. The plain jade (#5A9A8A) is
only 3:1 on the background, so it's for shapes, never text; use the text
shades above. The favourite heart (#D6336C / #F06595) is also pink, and
close to the accent in dark mode; it's always the heart shape, so it still
reads as "favourite".

The pantry's Have / Low / Out colours stay green, amber and red: they mean
something at a glance.

**Type.** The phone's own font (system-ui), so it reads like a normal app;
the drawn title carries the personality. Page titles ("Dinner plan",
"Pantry", "The fridge door"…) are in Pond Pebbles, The Koi Pond's own
display font (decided 2026-11-06). Only for text we write: it has no
accented letters, so a recipe's own name (on its page) stays in the
phone's font, and so do buttons and anything longer than a title.

**Follows the phone.** Light or dark mode comes from the phone's setting.

**Compact, not airy** (Xel, 2026-11-09, picked from side-by-side screenshots
of "Now", "Snug" and "Compact"): 15px text, about 8px between things,
list rows 36–38px tall (still well over the smallest tappable size; the
app had 44–52px). More of a list fits on one screen: the whole shopping
list, eight days of the plan. New screens follow the same spacing rather
than the roomier defaults. Two layouts changed with it (picked from
mock-ups the same day): on the plan, a second dish is added with a "+"
beside the last dish's ✕, not a "+ Dinner" under every planned day; on a
recipe, the details, tags, ratings and cooking history share one box,
split by thin lines, instead of three boxes.

**Bento touches** (Xel, 2026-11-09, picked from mock-ups on the real
screens): section headings we write ("Ingredients", "Got it", shelf and
pantry place names) are in Pond Pebbles too; the pantry's Have / Low / Out
is a little jar (full, a little left, empty) instead of signal bars,
keeping its words and colours; ticked shopping items get a brush stroke
instead of a thin line; a round "Cooked" stamp sits beside "Last had"; a
recipe without a photo shows a small drawn bento box with its first
letter instead of 🍲 (kept soft after seeing it live: a faint box and
leaf, the plum, and a big letter); and two-way switches (Simple | Detailed, List |
Month…) show the chosen one with a wooden chopstick underline and the
other faded, Xel's own design (instead of an iPhone-style pill).

**Bento trays** (Xel, 2026-11-09, picked live from dark lacquer, natural
wood and soft jade rims): things that belong together sit in a tray, a
soft jade rim (#B9D6CD light, #2C4A44 dark) with rounded compartments
inside, and the chosen one filled. Used for groupings, not everything: a
recipe's details box (details, tags, ratings, history, Time it), each
pantry place (its name on the rim, subcategories as compartments), the
shopping list (aisles as compartments), the plan (weeks on the rim, days as
compartments, "Add these to the shopping list" as its last one; in the
month view the weekdays on the rim, the month's days as compartments with
today filled, other months' days as faint outlined ghosts of compartments
(so they don't read like the weekday letters), then the chosen day's meals and
the shopping button), the recipe shelves (each recipe a compartment, the
last row filled out with recessed empty ones in the card layouts), the tab
bar, the pantry's filter chips and the Recipes page's search with its tag,
quick and favourite filters, Browse's sites, and the Pantry, Shopping and
Browse search boxes (the Shopping list's has a book beside Add for "Add
from a recipe", Xel's pick over a row of its own). Loose lines between
trays ("6 recipes") and page titles ("Browse", a recipe's name) start
where a tray's compartments do, not at the page's edge (`--tray-inset`);
buttons and switches beside them still line up with the trays' edges. A group's label inside a
compartment (the pantry's "Dairy", the shopping list's "Fruit & veg") is
centred on a faint line, "— Dairy —" (`.divider-label`, Xel's pick over
plain centred or left). A section heading over a list goes inside
the tray's top rim, with any button beside it, like a recipe shelf
("Our sites", "Recipe sites", "Got it": `.tray-section`; Xel's pick over
a tab or a ruled line). Buttons, text
boxes, tips, pop-ups and the chopstick switches stay plain; no tray inside
a tray.

**The plan's meals** (Xel, 2026-11-09, tried live): each planned dish is a
soft jade chip (drag dots, a round picture close beside them, the name),
side by side when the names fit. A quiet dashed "+" beside a meal's chips
adds a side. There's no ✕ on them: dragging one shows a bin over the tab
bar, and dropping it there takes it off the plan, with Undo. The month
view's day list keeps an umeboshi ✕, so nobody has to drag to remove.

**Messages** (Xel, 2026-11-09): a short message after a tap ("Moved to
the Fridge.", "“Milk” is already on the list.", "The scanner isn't ready
yet…", a delete that failed) shows at the bottom of the screen like Undo,
goes by itself (an error a little later, with a plum stripe), and a tap
puts it away; with an Undo bar showing it sits just above it. A form's own
errors stay beside their box, and a page that can't load says so in
place. A message that needs a link or a button of its own ("Open the
list", the shelves' Undo) stays where it is for now.

**The dinner chooser** (Xel, 2026-11-09, version A from live mock-ups):
recipes first, the main job. Search and its three filters are one tray,
then Surprise me and the count, then the recipes as compartments (the list
scrolls inside the sheet), and "Or just a note" last, a tray of its own
with the box and the quick notes, always in view. "Out of …" is a calm
amber and "Planned …" plain grey: worth knowing, not alarming. A
surprise pick is a plum tray (its line in the rim, the recipe, then
Plan this and 🎲 Another as compartments), standing out from the jade.

**The ⋮ menu and Settings** (Xel, 2026-11-09): the menu holds only what
you reach for mid-task: your profile row, Keep screen on, Settings, and an
update once one is waiting. Settings (its own page) holds what you set
once, in trays: Appearance (light or dark: Auto follows the device,
or always Light or Dark, on this device), Recipes (Quick means, nutrition, amounts in the method,
step photos, shelves start closed), Household (country, tablespoon,
meals on the plan), Your data (import and export, backups) and App (the
server, checking for updates), with the "A Koi Pond app" credit quietly
at the very bottom. Profile links to the Household page, which is only
who's in it and adding someone ("Share Bentotachi" when you're alone;
none on a phone-only Bentotachi), and ends with Log out (or "Join a
household" on a phone).

**The fridge door** (Xel, 2026-11-09, tried live): the splash line on a
torn strip of masking tape, a little crooked, centred under the title
(picked over poetry magnets and Ben saying it). A soft jade enamel
panel with a handle down its right edge, everything below the splash line
stuck on it. Each note is on paper in its writer's colour (from Settings;
someone without one gets white, soft plum or peach), and the box to write
in is a blank note in your own colour. Notes are held by fridge magnets in
their own colours (mostly umeboshi plums, some leaves and onigiri, now and
then a tiny Ben), sit in two loose columns, and peel off when Done (no
animation for reduced motion). From 3 days a note fades and its corner
curls, more so from a week. An empty door shows spare magnets, Ben, and
"Suspiciously tidy."

Removing something small (a note, a pantry item, one of our sites)
happens at once with Undo. Something big or one-way (deleting a recipe,
restoring a backup) asks first in the app's own small dialog, with buttons
that say what they do ("Delete", "Keep editing"); never the browser's own
"Are you sure?" box.

## What it won't become

- A social network: no public feed, followers or recipe sharing with
  strangers. Sharing is with your household. *(guess)*
- An AI recipe writer or meal "suggester". *(guess)*
- Anything with ads, subscriptions, a paid tier or tracking.
- Anything that needs a company server to work.
- A general-audience app that sands off the personality.

## Open questions

- In-app voice: how cheeky do empty screens and messages get, and when?
- Mascot moods: which ones first, and who draws them (ChatGPT plus a
  traced SVG, like the mascot)?
- iPhone: try the browser version in Safari with a server?
- Languages: English only for now (the Dutch tester will see English).

## Decided so far

- 2026-10-30: renamed from Cookbook to Bento.
- 2026-10-31: phone-only is the default; a server is the extra for sharing.
- 2026-11-01: renamed Bentotachi ("Bento" alone is crowded); new drawn
  title; the mascot is the screaming onigiri on chopsticks; silly is
  welcome, not aiming at everyone; no subscriptions, ever; store logos stay
  inside the app (not in the Play listing); a desktop browser version via a
  server is part of the plan; the title's leaf gets baran ridges, in jade,
  and jade becomes the second accent (tags, success messages); an
  umeboshi replaces the title's sakura.
- 2026-11-02: the pantry never pushes stock-taking, but makes room for
  people who want it: Have / Low / Out by hand always works, and counting
  packets is there for whoever wants it, out of the way of everyone else.
- 2026-11-09 (Xel): adding to the pantry should be effortless. Scanning
  something new counts the one in hand (its brand and size from Open Food
  Facts); scanning a barcode an item already knows adds one by itself, no
  tap, when that item's stock is counted, with Undo on the bottom bar.
  Items nobody counts aren't started on: they still offer "+ Add this one".

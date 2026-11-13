---
name: Bentotachi
description: A household's shared recipes, dinner plan, shopping list and pantry, packed like a bento.
colors:
  tea-rice: "#f3f6f4"
  surface: "#ffffff"
  soy-ink: "#2b2420"
  quiet-grey: "#5f6b67"
  border-mist: "#d8dddb"
  umeboshi: "#a82d4a"
  on-umeboshi: "#ffffff"
  umeboshi-soft: "#f4e4e7"
  jade-soft: "#e2efeb"
  jade-strong: "#3f7668"
  jade-leaf: "#5a9a8a"
  rim: "#b9d6cd"
  rim-text: "#24312d"
  waribashi-wood: "#a87a43"
  danger: "#b3261e"
  pantry-have: "#3f7668"
  pantry-low: "#e0a100"
  pantry-out: "#c62828"
  heart: "#d6336c"
  rice: "#fffdf6"
  rice-line: "#3a2f28"
  nori: "#24312d"
  rice-off: "#c9cfcc"
  pond-at-night: "#141b1b"
  pond-surface: "#202928"
  pond-text: "#f1ebe5"
  pond-quiet: "#a9b3ae"
  pond-border: "#34403e"
  umeboshi-night: "#ee7d92"
  umeboshi-soft-night: "#33282c"
  jade-soft-night: "#1d3330"
  jade-strong-night: "#7fbfae"
  rim-night: "#2c4a44"
  rim-text-night: "#e2efeb"
  danger-night: "#ff8a65"
  pantry-low-night: "#ffca28"
  pantry-out-night: "#ff6b66"
typography:
  display:
    fontFamily: "Pond Pebbles, system-ui, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Pond Pebbles, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.01em"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  label-small:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.4
  hint:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  compartment: "8px"
  bubble: "10px"
  tray: "12px"
  sheet: "18px"
  pill: "999px"
spacing:
  rim-thin: "4px"
  rim: "5px"
  rhythm: "8px"
  tray-inset: "8px"
  gap-wide: "12px"
  card: "16px"
components:
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.soy-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "38px"
  button-primary:
    backgroundColor: "{colors.umeboshi}"
    textColor: "{colors.on-umeboshi}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "38px"
  button-ghost:
    textColor: "{colors.soy-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "38px"
  button-danger:
    textColor: "{colors.danger}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "38px"
  button-small:
    rounded: "{rounded.pill}"
    padding: "4px 14px"
    height: "36px"
  icon-button:
    textColor: "{colors.soy-ink}"
    size: "44px"
  icon-button-hover:
    backgroundColor: "{colors.umeboshi-soft}"
  icon-button-primary:
    backgroundColor: "{colors.umeboshi}"
    textColor: "{colors.on-umeboshi}"
    size: "44px"
  chip-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.soy-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 14px"
    height: "36px"
  chip-filter-selected:
    backgroundColor: "{colors.soy-ink}"
    textColor: "{colors.tea-rice}"
  input:
    backgroundColor: "{colors.tea-rice}"
    textColor: "{colors.soy-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.compartment}"
    padding: "7px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tray}"
    padding: "{spacing.card}"
  tray:
    backgroundColor: "{colors.rim}"
    textColor: "{colors.rim-text}"
    rounded: "{rounded.tray}"
    padding: "0 5px 5px"
  tray-compartment:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.compartment}"
    padding: "10px 12px"
  tab-bar:
    backgroundColor: "{colors.rim}"
    padding: "{spacing.rim-thin}"
    height: "60px"
  tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.quiet-grey}"
    rounded: "{rounded.compartment}"
  tab-active:
    backgroundColor: "{colors.jade-soft}"
    textColor: "{colors.umeboshi}"
  view-switch:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.quiet-grey}"
    rounded: "{rounded.tray}"
    padding: "2px 4px"
  view-switch-chosen:
    textColor: "{colors.soy-ink}"
  step-number:
    backgroundColor: "{colors.umeboshi-soft}"
    rounded: "{rounded.pill}"
    size: "28px"
  toast:
    backgroundColor: "{colors.soy-ink}"
    textColor: "{colors.tea-rice}"
    rounded: "{rounded.tray}"
    padding: "10px 14px"
---

# Design System: Bentotachi

## Overview

**Creative North Star: "The Household Bento"**

Everything is packed in its compartment. Things that belong together sit in a tray: a soft jade rim with rounded compartments inside, the chosen one filled. Umeboshi plum sits on tea-rice the way the pickled plum sits on rice, and it marks what you can do. A wooden chopstick (waribashi wood) underlines the chosen thing. Nothing floats loose: loose lines between trays and page titles start where a tray's compartments start, and buttons beside them line up with the trays' edges.

The feel is compact, homely and cheeky. Compact, not airy: 15 px text, about 8 px between things, list rows 36 to 38 px tall, so the whole shopping list or eight days of the plan fit on one screen. Homely: warm, lived-in materials (a jar for the pantry level, a brush stroke for a bought item, a round "Cooked" stamp, a fridge door with magnets) rather than generic app chrome. Cheeky in the corners only: Ben the screaming onigiri and the jokes live in empty screens, hints and small print, never on a button or in the way of the facts.

The surface is flat. Depth comes from tonal layering (white compartments on a jade rim on a tea-rice page), not from shadows. Shadows exist only on things that genuinely float over the page. The cream-and-terracotta palette people now read as AI-made is rejected outright; that is why the page is tea-rice and the accent is umeboshi. The phone's own font carries the reading; the drawn title, Ben and Pond Pebbles carry the personality. The art and Pond Pebbles were made with AI help and are never described as hand-drawn or hand-lettered.

**Key Characteristics:**
- Bento trays: a jade rim (5 px) around white 8 px-rounded compartments, inside a 12 px-rounded tray.
- Two accents with fixed jobs: umeboshi plum does things, jade labels things and brings good news.
- Compact density with a 44 px tap area under every control.
- Flat at rest; shadows only for floating layers.
- Pond Pebbles for the titles and section headings the app writes; the phone's font for everything else.
- Light "tea-rice" and dark "pond at night", with every contrast ratio kept the same.

## Colors

A cool, near-white tea-rice page with two bold colours only, umeboshi plum and jade, plus waribashi wood for the chosen thing and the pantry's fixed traffic-light statuses.

### Primary
- **Umeboshi** (#a82d4a light, #ee7d92 dark as umeboshi-night): the colour of doing. Primary buttons, the main "+" icon button, links, link buttons, focus rings (3 px outline), the selected tab's label, a picked recipe card's outline, the current timer stage, an error toast's stripe and the brush stroke over a bought shopping item. 6.7:1 on white, 6.1:1 on tea-rice.
- **Umeboshi Soft** (#f4e4e7 light, #33282c dark): the quiet plum wash. Hover behind icon buttons and menu rows, step-number discs, help tips that open underneath, the update banner, a finished timer row. Plum text on it stays above 5.4:1.

### Secondary
- **Jade Strong** (#3f7668 light, #7fbfae dark): the jade for text and solid fills. Success messages ("Saved."), a switch that is on, ticked checkboxes, the selected tag chip (white or dark text on it), the pantry edit panel's inner stripe.
- **Jade Soft** (#e2efeb light, #1d3330 dark): jade tags, the active tab's compartment, an active toolbar filter, the plan's dish chips, the brand's sticky note, one of the no-photo stand-in backgrounds.
- **Jade Leaf** (#5a9a8a): the title's leaf and baran divider. Shapes only (the leaf on the fridge door, the faint baran in the no-photo bento); it is 3:1 on tea-rice, so never text.

### Tertiary
- **Waribashi Wood** (#a87a43, both themes): the wooden chopstick. The underline under the chosen side of a two-way switch, the magnet on the brand's sticky note, Ben's chopsticks and the fridge door's magnets. It marks a chosen thing; it never carries text.

### Neutral
- **Tea-Rice** (#f3f6f4; dark: Pond at Night #141b1b): the page background and the inside of text boxes.
- **Surface White** (#ffffff; dark #202928): cards, compartments, the top bar, buttons, chips, menus, sheets and dialogs.
- **Soy Ink** (#2b2420; dark #f1ebe5): body text, and the fill of a selected filter chip and of a toast, with tea-rice text on it.
- **Quiet Grey** (#5f6b67; dark #a9b3ae): everything quiet: hints, placeholders, unchosen switch sides, inactive tabs, ticked steps and bought items, "(optional)", counts.
- **Border Mist** (#d8dddb; dark #34403e): 1 px borders on cards, buttons, chips, inputs, the top bar's bottom edge, an off switch's track.
- **Rim** (#b9d6cd; dark #2c4a44) with **Rim Text** (#24312d; dark #e2efeb): every bento tray's rim and the words written on it (shelf names, pantry places, tray headings), and the tab bar.

### Status and household colours
- **Pantry Have / Low / Out** (#3f7668 / #e0a100 / #c62828 light; #7fbfae / #ffca28 / #ff6b66 dark): the pantry level jar and its word. Low text on jade mixes 45% amber with soy ink to stay at 5.2:1.
- **Danger** (#b3261e; dark #ff8a65): errors, delete buttons, warning text. Dark danger is pushed orange so it never reads as a pink link.
- **Heart** (#d6336c; dark #f06595): the favourite heart only; it is always the heart shape, which keeps it apart from the dark accent.
- **Onigiri ratings** (rice #fffdf6, rice line #3a2f28, nori #24312d, an empty one's outline #c9cfcc; dark rice #f4efe4, nori #1c2624, empty #4a5653): the household's rating marks.
- **Person colours** (`PERSON_COLORS` in `web/src/pb.ts`): one mid-tone palette for both themes, never used raw.

### Named Rules
**The Plum Does, Jade Tells Rule.** Umeboshi is for doing: buttons, links, the selected thing, focus. Jade is for labels and good news: tags, success, "have", switches that are on. Jade never fills a button.

**The Leaf Is Not Text Rule.** The plain jade leaf (#5a9a8a) is 3:1 on the background, so it draws shapes only. Jade words use Jade Strong.

**The Traffic Light Rule.** Have, Low and Out stay green, amber and red in both themes, whatever the palette around them does. They mean something at a glance.

**The Person Mix Rule.** A person's colour is never used raw. As text it is 65% the colour and 35% soy ink (`color-mix(in srgb, var(--person) 65%, var(--text))`), as a fill under white text 70% the colour and 30% black. Every person-coloured text or fill uses one of these two mixes.

**The Muted, Not Faded Rule.** Something quiet takes Quiet Grey, never opacity, so its words still read at 4.5:1. Opacity is for disabled controls, a thing being dragged, and soft decoration that carries no words.

## Typography

**Display Font:** Pond Pebbles (with system-ui, sans-serif)
**Body Font:** system-ui (with -apple-system, Segoe UI, sans-serif)

**Character:** The phone's own font makes it read like a normal app; Pond Pebbles, The Koi Pond's own rounded display face, gives the titles and section headings a pebbly, homely voice. Pond Pebbles has no accented letters, so anything people type stays in the phone's font.

### Hierarchy
- **Display** (Pond Pebbles 400, 1.8rem, 1.1, 0.01em): page titles ("Dinner plan", "Pantry", "The fridge door").
- **Headline** (Pond Pebbles 400, 1.25rem, 1.2, 0.01em): section headings the app writes ("Ingredients", "Got it"), recipe shelf names and pantry place names on their tray rims. In dark mode these get a tight dark outline (`text-shadow`) so light letters stand off the rim.
- **Title** (system-ui 700, 1.25rem, 1.2): headings inside dialogs and sheets (1.1rem in a sheet's head), and a recipe's own name, which is often in a language Pond Pebbles can't set.
- **Body** (system-ui 400, 15 px as 0.9375rem, 1.4): everything else. Rem, so it follows the browser's text size.
- **Label** (system-ui 600, 0.9375rem; 0.92rem on small buttons and chips): buttons, field labels, legends.
- **Label Small** (system-ui 600, 0.85rem): drawer counts, link buttons (0.88rem), badges (0.78rem, 700).
- **Hint** (system-ui 400, 0.88rem, 1.45): hints under fields and the "?" tips, in Quiet Grey or soy ink on a bubble.

### Named Rules
**The Pebbles For What We Write Rule.** Pond Pebbles sets page titles and the section headings the app writes, nothing else: never buttons, body text, dialog titles, counts or badges beside a heading, or anything people type (a recipe's name stays in the phone's font).

**The No Eyebrow Rule.** No uppercase, letter-spaced labels or kickers above headings, and no dotted word lists. Taglines and labels are real sentences in sentence case. The only uppercase in the system is the lettering pressed into the round "Cooked" stamp.

## Layout

A single column of at most 760 px, centred, with 8 px top and 10 px side padding inside the page; forms narrow to 520 px. A fixed top bar (white, with a 1 px bottom border) stays put while the page scrolls under it, and a fixed tab bar of 60 px (plus the phone's safe area) sits at the bottom as a tray. The page ends with room for the floating timer tray and Undo messages so they never cover the last thing.

Density is compact on purpose: about 8 px between things (stacks gap 8 px, button rows gap 8 px, section heads 12 px), cards padded 16 px (20 px felt airy on a phone), list rows 36 to 38 px tall, buttons 38 px, small buttons and chips 36 px. Trays hold their compartments with a 4 to 5 px rim and 4 to 5 px gaps. Loose lines and page titles between trays are inset 8 px (`--tray-inset`) to start where the compartments do. Recipe cards sit in an auto-fill grid of at least 220 px columns with a 14 px gap. Rows of buttons line up on the right, the main action last; Delete, Remove and Reset go first, pushed to the left.

### Named Rules
**The Compact, Not Airy Rule.** New screens use the same 15 px text, 8 px rhythm and 36 to 38 px rows, not roomier defaults. More of the list on one screen is the point.

**The 44 To Tap Rule.** Every control is at least 44 by 44 px to tap, even when it is drawn smaller: an invisible `::before` reaches `--tap-x` / `--tap-y` past it, each reach at most half the gap to the next control. The look stays compact; the target never shrinks with it.

**The Text-Zoom Rule.** Android's web view enlarges font sizes but not rem or em in other lengths, so any size that holds text is written `max(<px>, calc(<rem or em> * var(--text-zoom, 1)))`. It looks the same in a browser and grows with the phone's biggest text.

## Elevation & Depth

The system is flat and uses tonal layering: a white compartment on a jade rim on a tea-rice page reads as depth without any shadow. Cards and trays have no shadow at all; a card has a 1 px Border Mist edge, a tray has its rim. Shadows appear only on things that float over the page, and as small lifts on objects sitting on other objects. Inset box-shadows are used as rings and edges, not as depth.

### Shadow Vocabulary
- **Dialog** (`box-shadow: 0 10px 30px rgb(0 0 0 / 0.3)`): the app's own "are you sure?" dialog, over a 45% black backdrop.
- **Sheet** (`box-shadow: 0 -8px 30px rgb(0 0 0 / 0.25)`): a panel sliding up from the bottom, like the dinner chooser.
- **Menu and popover** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.15)` for the ⋮ menu; `0 6px 20px rgb(0 0 0 / 0.18)` for a "?" bubble; `0 8px 28px rgb(0 0 0 / 0.22)` for pickers): panels that open over the page.
- **Floating bar** (`box-shadow: 0 4px 16px rgb(0 0 0 / 0.18)` for the timer tray; `0 4px 16px rgba(0, 0, 0, 0.2)` for toasts): bars that hover above the tab bar.
- **Dragged** (`box-shadow: 0 10px 24px rgb(0 0 0 / 0.25)`): a dish or shelf lifted while it is dragged.
- **Small lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.3)` on a switch thumb; `0 2px 8px rgb(0 0 0 / 0.25)` on the heart over a photo; `0 1px 4px rgb(0 0 0 / 0.2)` on a pick mark; `0 2px 4px rgb(0 0 0 / 0.14)` on the brand's sticky note; `0 2px 6px rgb(0 0 0 / 0.12)` on fridge-door notes): a physical thing resting on another.
- **Ring** (`box-shadow: 0 0 0 2px var(--accent)` for a drop target; `inset 0 0 0 1.5px …` for an off switch's edge and a ticked step's number): an outline drawn without changing layout.

### Named Rules
**The Tray, Not Shadow Rule.** Grouping and hierarchy come from rims, compartments and tone. A card or tray never gets a shadow to stand out.

**The Floating Only Rule.** A drop shadow means the thing is above the page (a dialog, sheet, menu, bubble, toast, timer tray, or something being dragged) or a small object sitting on another. If it scrolls with the page and holds content, it is flat.

## Shapes

Rounded and soft throughout, with radius telling you what a thing is. Trays and cards are gently rounded (12 px, `--radius`); compartments, inputs and tabs inside them are tighter (8 px), so the rim reads as a consistent band. Help bubbles and timer stages sit between (10 px). A sheet's top corners are 18 px. Buttons, chips, badges, the pantry level meter and rating pills are full pills (999 px); icon buttons, step numbers, avatars, the "?" and the "Cooked" stamp are circles. Borders are 1 px Border Mist; the "?" uses a 1.5 px ring in its own colour. A month view's days from other months are dashed, outlined ghost compartments. The chopstick underline is a 4 px wooden bar, a touch thicker at one end (clipped to a long wedge). Things that are objects in the world (the stamp at -9°, the brand's note at 7°, the fridge door's tape and notes) are a little crooked; interface controls never are.

## Components

### Buttons
Plain, rounded and flat, saying exactly what they do.
- **Shape:** full pill (999 px), 38 px tall, 1 px border.
- **Primary:** Umeboshi fill and border with white text (dark text in dark mode), weight 600, padding 6 px 14 px. One per row, last, on the right.
- **Secondary (default):** Surface White with a Border Mist edge and Soy Ink text.
- **Ghost:** no fill or border; for low-weight actions beside others.
- **Danger:** transparent with Danger text and border; Delete and the like, pushed to the left of a row.
- **Small:** 36 px tall, padding 4 px 14 px, 0.92rem; slimmer still (28 px) in a tray's rim.
- **Hover / Focus:** focus is a 3 px Umeboshi outline 1 px off the edge; disabled drops to 60% opacity. No hover lift, no shadow.
- **Icon buttons:** 44 px circles, transparent, Umeboshi Soft behind them on hover or while their menu is open; the main "+" is a filled Umeboshi circle. Small ones holding a character ("‹", "−", "+") are 36 px, growing with `--text-zoom`, in Quiet Grey.
- **Link buttons:** Umeboshi text, weight 600, 0.88rem, no box.

### Chips
- **Style:** filter chips are 36 px pills on Surface White with a Border Mist edge, 0.92rem Soy Ink text, 8 px apart, wrapping.
- **State:** a chosen filter chip fills with Soy Ink and its text turns tea-rice; a plain action chip is borderless Umeboshi text. Tags are jade: Jade Soft at rest, Jade Strong with white text when selected. The plan's dishes are Jade Soft chips with drag dots and a round picture.

### Cards / Containers
- **Corner Style:** 12 px for cards and trays, 8 px for compartments.
- **Background:** Surface White cards on tea-rice; trays are Rim with Surface White compartments.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** cards and recipe cards 1 px Border Mist; compartments have no border, the rim is their edge.
- **Internal Padding:** cards 16 px; compartments 10 px 12 px; a tray's rim 5 px (4 px in the tab bar and joined boxes).

### Bento trays (signature)
The system's defining container. A section heading (and a slim button beside it) sits in the tray's top rim in Rim Text; what follows sits in compartments. Used for groupings: recipe shelves (each recipe a compartment, the last row filled out with recessed empty ones), pantry places (subcategories as compartments, split inside one compartment by a faint centred "— Dairy —" line), the shopping list (aisles), the plan (weeks on the rim, days as compartments), the Recipes page's search with its filters, Browse's sites, Settings' groups, and the tab bar. The chosen compartment is filled.

### Inputs / Fields
- **Style:** tea-rice background (a step below the white card around it), 1 px Border Mist, 8 px radius, padding 7 px 12 px, body type. Labels sit above in weight 600 with a 4 px gap. Placeholders are Quiet Grey at full opacity. Selects are at least 44 px tall.
- **Focus:** a 3 px Umeboshi outline, 1 px off. In a joined box (the Pantry, Shopping and Browse boxes, and the Recipes search) the box and its button are compartments of one tray, and the outline wraps the whole tray rather than the box alone.
- **Error / Disabled:** a form's errors sit under the box in Danger and are read out as they appear; a disabled select drops to 55% opacity. Checkboxes are 22 px and tick in Jade Strong.

### Navigation
- **Top bar:** Surface White, 1 px bottom border, the drawn title at 36 px tall on the left (its sticky note beside it), 44 px icon buttons on the right; a crossed-out cloud appears only when the server can't be reached.
- **Tab bar:** a tray. Rim background, 4 px rim and gaps, each tab an 8 px-rounded Surface White compartment with a small icon above a 0.8rem weight-600 label in Quiet Grey. The current tab fills Jade Soft with an Umeboshi label. Labels shorten with "…" at the biggest text rather than spill.
- **Two-way switch:** a white 12 px-rounded strip with a 1 px border; each side 32 px tall, 0.88rem weight 500 in Quiet Grey. The chosen side turns Soy Ink, weight 700, with the wooden chopstick (4 px, Waribashi Wood) underneath. Never an iPhone-style sliding pill.
- **Toggle switch:** a 40 by 24 px pill track in Border Mist with a 1.5 px edge so it shows when off; on, it turns Jade Strong and the white thumb slides 16 px.

### Messages
Toasts float above the tab bar: Soy Ink with tea-rice text, 12 px radius, the Floating bar shadow; an error adds a 5 px Umeboshi stripe on its left. A tap puts one away. The "?" help button is a 22 px Quiet Grey ring that turns Umeboshi when open; its bubble is Surface White with a 1 px border and a small pointer.

### Pantry level jar (signature)
The pantry's Have / Low / Out is a little jar (full, a little left, empty) beside its word, in a 32 px pill with the real select laid invisibly over it. Have is quiet (no outline, Quiet Grey word) so Low and Out stand out in amber and red.

### Cooking marks (signature)
- **"Cooked" stamp:** a 46 px round hanko beside "Last had", a double Umeboshi ring, the word in Pond Pebbles at 0.6rem, rotated -9°.
- **Step numbers:** 28 px Umeboshi Soft discs (growing with `--text-zoom`); a ticked step's number becomes an empty Border Mist ring and its text Quiet Grey, struck through.
- **Brush-stroke tick:** a bought shopping item turns Quiet Grey with an Umeboshi brush stroke through it instead of a thin line.
- **No-photo stand-in:** a soft drawn bento box (faint outline, faint baran leaf, the plum, a big Pond Pebbles first letter) on one of five soft backgrounds.

## Do's and Don'ts

### Do:
- **Do** group related things in a bento tray: Rim (#b9d6cd / #2c4a44) with 8 px-rounded Surface White compartments, heading on the rim, the chosen compartment filled.
- **Do** use Umeboshi for anything you tap to act (buttons, links, the selected thing, the 3 px focus ring) and jade for labels, tags, "have" and good news.
- **Do** keep 15 px body text, an 8 px rhythm and 36 to 38 px rows, with every control reaching 44 by 44 px to tap.
- **Do** write sizes that hold text as `max(<px>, calc(<rem> * var(--text-zoom, 1)))`.
- **Do** make quiet things Quiet Grey (#5f6b67 / #a9b3ae), never faded.
- **Do** mix person colours toward Soy Ink for text (65%) and toward black for fills under white text (70%).
- **Do** mark the chosen side of a two-way switch bold with the wooden chopstick underline.
- **Do** put every dark-mode rule in a `@media (prefers-color-scheme: dark)` block, so the app's own Light / Dark choice (`web/src/theme.ts`) can switch it.
- **Do** keep text contrast at least 4.5:1 (3:1 for large text) in both themes.

### Don't:
- **Don't** fill a button with jade, or set words in the plain jade leaf (#5a9a8a).
- **Don't** give cards or trays a shadow; shadows are for dialogs, sheets, menus, bubbles, toasts, the timer tray and dragged things.
- **Don't** put a tray inside a tray; buttons, text boxes, tips, pop-ups and the chopstick switches stay plain.
- **Don't** use uppercase, letter-spaced eyebrow labels or dotted word lists.
- **Don't** set buttons, body text, dialog titles or anything people type in Pond Pebbles.
- **Don't** recolour Have / Low / Out away from green, amber and red.
- **Don't** use opacity to make text quiet.
- **Don't** drift back toward cream backgrounds with a terracotta accent.
- **Don't** let a joke replace what a button or warning does.
- **Don't** describe the title, Ben or Pond Pebbles as hand-drawn or hand-lettered.

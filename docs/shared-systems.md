# Shared pieces: use these, don't write another

Many sessions build Bentotachi without remembering each other, so a helper
written twice drifts apart. Before writing a helper or component, find its
job here and use (or extend) what's listed, with its tests. A new shared
piece gets a line here. Riskiest first. Paths are under `web/src/` unless
they say otherwise.

## Who can see and change what

- Any logged-in household member can read and change every collection,
  except: `users` (everyone sees every account's fields except email and
  password, so nothing private goes there; any member can add an account;
  each changes only their own),
  `recipe_ratings` (each changes only their own), `cooked` (no editing an
  entry) and `household_settings` (no deleting). Set in
  `server/pb_migrations/`, never in the app.
- "Added by" / "Cooked by": the server sets them to whoever is logged in
  (`server/pb_hooks/who_added.pb.js`). That only runs on record requests; a
  custom route that saves records sets it itself, as `import.pb.js` does.
- The server fetching a web address for someone: `isPublicUrl`
  (`server/pb_hooks/safe_url.js`) first, always, so nobody can reach the
  home network through it.
- New server routes: end with `$apis.requireAuth()`, as every route does
  except first-time setup and app updates, which are public on purpose.
- Single-user mode (one account hides the "other people" parts):
  `useSingleUser`, and `forEveryone(singleUser)` for " for everyone" in
  questions (`household.ts`).
- Household settings (country, tablespoon, meals on the plan): `useCountry`,
  `useTablespoon`, `usePlanMeals`, `useStores` (`household.ts`).
- The logged-in person: `useCurrentUser`, their name `displayName`, their
  colour `personStyle`, picture `avatarUrl` / `<Avatar>` (`pb.ts`, `Avatar.tsx`).
- Logging out or switching servers: `logOut({ keepWaiting })` (`pb.ts`),
  which wipes the phone's copies (`forgetOfflineCopy`, `offline.ts`) and the
  login. A new offline copy's key goes in forgetOfflineCopy's list, or the
  next person on the phone sees it.
- Live updates that failed to start are sent again when the connection
  comes back: call `liveUpdateFailed()` (`liveResend.ts`) in a new
  subscription's catch.

## Saved data and syncing

- Talking to a collection: the typed helpers in `pb.ts` (`recipes()`,
  `pantryItems()`, `users()`, ...), not `pb.collection("...")` (only
  `household_settings` and `useLiveRecords` use that).
- A shared list on screen: `useLiveRecords` (load, live updates, reload on
  return, offline copy with `offlineKey`).
- Before loading or sending: `ensureLogin` / `ensureLoginNow` (`session.ts`;
  an expired login looks like an empty list, not an error).
- Saving an edit: send only the changed fields, `changedFields`
  (`changedFields.ts`), so a housemate's change meanwhile isn't put back.
  Pantry items: `editChanges` (`pantryFields.ts`).
- Read-what's-saved-then-save on one page (a link, a step photo): one at a
  time through `inTurn` (`inTurn.ts`; the recipe page's `recipeSaves`), so
  a second quick choice doesn't undo the first.
- Remembering something on this device (a setting, a view): `remembered` /
  `rememberedJson` / `remember` (`phoneStorage.ts`), never raw
  `localStorage`. Offline copies of lists: `read` / `write` and the `*_KEY`
  names (`offline.ts`); offline shopping changes: `offlineShopping.ts` and
  `useShoppingQueue` (`shoppingQueue.ts`).
- Adding to the shopping list: `addToShoppingList` (`shoppingAdd.ts`; skips
  what's already waiting, `newToTheList`). "Is it already on the list?":
  `sameThing`, for a pantry item `onTheList` (`shoppingMatch.ts`;
  `server/pb_hooks/pantry.pb.js` follows the same rule).
  How much the pantry's packets cover of what a recipe needs, and whether
  it's worth buying: `coversFor` / `coverOf`, `worthBuying`, `stillToBuy`,
  `coverNote` (`pantryStock.ts`); an amount in grams or millilitres:
  `quantityOf`, a packet's (what's left, else its size): `packetAmount`,
  saying one: `amountLabel`; a line's measured amount: `lineMeasure`
  (`scaling.ts`). What a cooked recipe used up: `cookedUses`
  (`cookedUses.ts`), offered by `<UsedUpSheet>`.
- Delete with Undo: `useUndo` (`undo.tsx`, rules in `pendingDelete.ts`).
  For small things (a note, a pantry item, one of our sites). Asking first,
  for one-way or big things: `askFirst` (`askFirst.ts`), never
  `window.confirm`; it works outside React too. Deleting recipes: `confirmDelete` / `deleteRecipes` (`recipeDeletion.ts`;
  the question from `deleteQuestion`, `deleteWarning.ts`).
- Leaving with unsaved typing: `useUnsavedChanges` / `confirmDiscard`
  (`unsavedChanges.ts`).
- A short message after a tap, at the bottom: `showToast` / `showError`
  (`toast.ts`, shown by `<Toaster />` in App.tsx), not a page's own
  `error` line or timer. Undo has its own (`useUndo`).
- Light or dark: Settings' choice (Auto, Light, Dark) rewrites the
  stylesheet's `@media (prefers-color-scheme: dark)` blocks (`theme.ts`).
  So dark styles go in such a block as usual, but code asks
  `useDarkMode()`, never `matchMedia("(prefers-color-scheme: dark)")` or a
  `<picture>`'s `media`, which would ignore the choice.
- The page's scroll: screens scroll inside `.page-scroll` (App.tsx),
  between the top bar and the tab bar, not the window. Read or move it, or
  listen to it, with `pageScroller` / `pageScrollTarget` /
  `pageScrollStart` (`pageScroll.ts`), never `window.scrollY` or
  `window.scrollTo`. Something sticky sits at `top: 0` /
  `bottom: var(--timer-tray-height, 0px)`, not offset by the bars, and
  needs no `overflow: hidden` between it and the page (`clip` is fine).
- Error text for people: `errorMessage` (`pb.ts`); "is it offline?":
  `isOffline` (`offline.ts`); `<OfflineNote>` to say so.
- Import size limits: `LIMITS` / `fitRecipe` (`server/pb_hooks/recipe_parse.js`),
  mirrored as `IMPORT_LIMITS` / `fitImported` (`paprikaImport.ts`; a test
  keeps the limits equal).

## Dates and times

- Calendar dates ("2026-11-02"): `dates.ts`. Today is `localToday` (never
  `toISOString().slice(0, 10)`, which is UTC), stored form `toStoredDate` /
  `datePart`, maths `dayNumber` / `addDays` / `weekStart`, showing
  `formatDay`, "3 days ago" `timeAgo`. A stored moment (`created`) as a
  Date: `storedTime`. Notes' "20 min ago": `noteAge` (`fridgeDoor.ts`).
- Expiry: `expiry.ts` (`daysUntil`, `describeExpiry`, `shortExpiry`).
- Minutes: `formatMinutes`, `totalMinutes`, `isQuick` (`format.ts`); times
  in text ("10 minutes") `stepTimes`, `formatDuration` (`stepTimers.ts`).

## Numbers, amounts and units

- Reading a number in recipe text: `NUMBER`, `parseNumber`, `amountRange`
  (`weights.ts`; `NUMBER` is also what `stepAmounts.ts` and `scaling.ts`
  read with). Showing one in kitchen fractions: `kitchenFraction`
  (`scaling.ts`).
- Scaling: `scaleLine`, `servingsCount` (`scaling.ts`); remembered size:
  `recipeScale.ts`.
- Unit hints: `withWeightHint`, `withVolumeHint` (+ `recipeMeasures`),
  `withTemperatureHint`, `withLengthHint`, `withRegionalHint` (their own files).

## Text and matching

- An ingredient's name in a line (whole words, plurals, accents):
  `findMention`, `mentions`, `stem`, `foldText` (`wordMatch.ts`).
- Recipe search: `searchVariants` (`regionalNames.ts`) + `matchesSearch`
  (`recipeSearch.ts`). Pantry search: `matchesPantrySearch` (`pantryGroups.ts`).
- Ingredient/step lines and tags: `textToLines`, `linesToText`, `headingOf`,
  `textToTags` (`format.ts`); the tag box: `tagText.ts`; shelves:
  `normaliseTag`, `inCategory` (`recipeCategories.ts`).
- Soft and bold marks: `softParts` / `withoutSoftMarks` (`softMarks.ts`),
  shown by `<SoftText>`, typed with `<FormatTextarea>` / `toggleMark`
  (`textFormat.ts`).
- Pantry names: `sameName` (`pantryFields.ts`); ingredient links:
  `pantryLinks.ts` (`linkFor`). A link can be an item or a group of kinds
  ("any pasta"): read it through `linkStatus`, `linkedItems` and
  `linkTarget`, not `link.item` alone; groups from `familiesOf`, a group's
  level from `familyStatus`, a sheet row's from `rowStatus` (`weekShopping.ts`).
- A site's name from its address: `siteHost` (`recipeSites.ts`; pass `""`
  as its second argument for blank instead of the address); store:
  `storeFor` / `storeName` (`stores.ts`).
- Recipes with the same name: `sameTitle`, `twinLabels` (`recipeTwins.ts`);
  "already imported": `alreadyHave` (`paprikaImport.ts`).
- Words on screen the US spells differently (favourite, colour, grey):
  `useSpell()` (`household.ts`), the word list in `spelling.ts`.

## Photos and files

- Shrinking any photo before upload: `shrinkPhoto` (`pantryPhoto.ts`; pass
  `PHOTO_SIDE` from `recipePhotos.ts` for recipes). Profile pictures:
  `squarePicture` (`avatarImage.ts`).
- Photo addresses: `recipeImageUrl`, `recipePhotoUrl`, `pantryPhotoUrl` (`pb.ts`).
- Saving a file (download, or Android's "save as"): `startFile`
  (`saveFile.ts`); Paprika exports `savePaprikaFile` (`paprikaSave.ts`).

## Screen pieces

- Any date box: `<DateField>` (`DateField.tsx`), never `<input type="date">`;
  its month grid and typed-date reading are `calendar.ts`.
- `?` tips: `useHelp` / `HelpButton` / `HelpBox` (`Help.tsx`). Icons:
  `icons.tsx`. Open/closed sections: `DrawerToggle.tsx`. Photos full screen:
  `PhotoViewer.tsx`. Screen stays on: `useWakeLock`. A pantry level (Have /
  Low / Out) as a picture: `LevelJar` (`icons.tsx`). A recipe without a
  photo: `<RecipeStandIn>` (`RecipeStandIn.tsx`), never an emoji. A bento
  tray (things that belong together): the `--rim` / `--rim-text` colours,
  a 5px rim around compartments of `--surface` with 8px corners; see the
  recipe box, pantry places, shopping list, plan and tab bar in
  `styles.css`, and docs/VISION.md "Bento trays" for where they go.
- A pantry item's labels (each one in stock, with its use-by and opened):
  `<StockLabels>` (`StockLabels.tsx`, grouping by `packetGroups`, the small
  words by `labelMeta`); the item's own date as their soonest:
  `server/pb_hooks/pantry_labels.js`. What "+ 1 more" adds: `nextPacket`
  (`pantryPackets.ts`). A pantry item's products (brand, size, barcodes,
  links; the favourite): `pantryProducts.ts` in the app, its list in the
  edit form `<ProductsField>`; the server's rules, which also keep the
  item's barcodes and store links from them and fold in older apps'
  changes: `server/pb_hooks/pantry_products.js`. A store link box:
  `<StoreLinkField>` (`StoreLinkField.tsx`). A calendar asked for without
  a date box: `<DateDialog>` (`DateField.tsx`). The pantry's place picker
  (its title): `<PlacePicker>` (`PlacePicker.tsx`). Moving one thing to
  where another is, as dragging does (shelves, places): `moved`
  (`listOrder.ts`). A message with a second
  button: `showToast(text, { action, extra })`. An item's quick card:
  `<PantryCard>`. Packet rules (`pantryPackets.ts`): a packet as saved or
  put back `packetToSave`, the last one making it Out `lastPacketRunsOut`,
  what adding one changes on the item `itemAfterPacket` / `learnsBarcode`.

## Scripts (`web/scripts/`)

- The Pi: `piConfig` (address, key, `sshOptions`), `onPi` to run a command
  there, `SSH` / `SCP` (`piConfig.mjs`). Only committed code goes out:
  `refuseUncommittedCode` (`committed.mjs`). All checks before sending:
  `runTests` (`tests.mjs`). Android builds with the right Java: `run`
  (`buildTools.mjs`).

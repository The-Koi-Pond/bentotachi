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
  home network through it. A website's page: `readPage` (`web_page.js`),
  which does that check and words a refusal; "is a recipe from this link
  already here?": `sameRecipe`, and a page's recipe list marked with it:
  `markHere` (same file; the import and categories routes use them).
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
- A shared list on screen: `useLiveRecords(collection, { expand, fields,
  sort, copy })` (load, live updates, reload on return, and again when the
  server answers after being unreachable, `RETRY_EVENT` from
  `connection.ts`; the offline copy is one of offline.ts's ready-made
  ones, made once outside the page: `recipesCopy`, `ratingsCopy`,
  `shelvesCopy`, `shoppingCopy`, `pantryCopy`, `packetsCopy`, `planCopy`,
  `cookedCopy`, `notesCopy`). A page that loads the same list in another
  shape (without the main page's `expand`) uses the `…CopyReadOnly` one,
  which never overwrites it.
- Before loading or sending: `ensureLogin` / `ensureLoginNow` (`session.ts`;
  an expired login looks like an empty list, not an error; "offline" when
  the server can't be reached).
- A load with no answer starting within 8 seconds counts as offline
  (`needsQuickAnswer` in `answerTimeout.ts` says which requests: not saves,
  except shopping list ones or once the server is known to be away; not
  uploads or the server's own routes). Every request goes out through
  `requestFetch` (`connection.ts`, set in `pb.beforeSend`).
- Whether the server can be reached, and when it last answered:
  `useConnection()` (`connection.ts`; every request reports through
  `requestFetch`, and a page showing its offline copy calls
  `connection.unreachable()`; checked every half minute while it's down).
  Shown by `<ConnectionStatus>` beside ⋮; `connection.checkNow()` asks at
  once (Try again). A page loading on its own (not `useLiveRecords`)
  listens for `RETRY_EVENT` to load again, like RecipeView.
- Saving an edit: send only the changed fields, `changedFields`
  (`changedFields.ts`), so a housemate's change meanwhile isn't put back.
  Pantry items: `editChanges` (`pantryFields.ts`).
- Read-what's-saved-then-save on one page (a link, a step photo): one at a
  time through `inTurn` (`inTurn.ts`; the recipe page's `recipeSaves`), so
  a second quick choice doesn't undo the first.
- Remembering something on this device (a setting, a view): `remembered` /
  `rememberedJson` / `rememberedRecord` (a `{ key: value }` table, like
  one per recipe) / `remember` (`phoneStorage.ts`), never raw
  `localStorage`; with `{ thisVisit: true }` for this visit only (never raw
  `sessionStorage`). Offline copies of lists: `read` / `write` and the `*_KEY`
  names (`offline.ts`); offline shopping changes: `offlineShopping.ts` and
  `useShoppingQueue` (`shoppingQueue.ts`). A record saved under an id
  picked beforehand (so sending it twice can't add it twice):
  `newRecordId` (`offlineShopping.ts`).
- Adding to the shopping list: `addToShoppingList` (`shoppingAdd.ts`):
  onto the line waiting for the same thing, adding up ("3 + 2 garlic
  cloves"), or a new line; a recipe already counted on a line isn't
  counted again (`plannedAdds`, `shoppingAddUp.ts`). Two lines as one
  ("5 garlic cloves", or null when they don't add up): `addedUp`; each
  recipe's part of a line, for its book button: `shares` /
  `sharesOf` (a deleted recipe's share loses its id on the server,
  `pb_hooks/shopping.pb.js`). Whether a gathered row is already on the
  list for its recipes: `plannedAdds` changes nothing (`GatheredTicks.tsx`). The amount a line starts with: `leadingAmount`
  (`scaling.ts`). "Is it already on the list?":
  `sameThing`, for a pantry item `onTheList` (`shoppingMatch.ts`;
  `server/pb_hooks/pantry.pb.js` follows the same rule), or under another
  wording ("300ml milk"): `onTheListAs`. Whether a line is just a thing
  with an amount ("2 cups milk", not "milk chocolate"): `isJustThis`
  (`pantryLinks.ts`).
  How much the pantry's packets cover of what a recipe needs, and whether
  it's worth buying: `coversFor` / `coverOf`, `worthBuying`, `stillToBuy`,
  `coverNote` (`pantryStock.ts`); an amount in grams or millilitres, or a
  count ("3 eggs", a "12 eggs" carton): `quantityOf`, a packet's (what's left, else its size): `packetAmount`,
  saying one: `amountLabel`; a line's measured amount: `lineMeasure`
  (`scaling.ts`). What a cooked recipe used up: `cookedUses`
  (`cookedUses.ts`), offered by `<UsedUpSheet>`.
- Delete with Undo: `useUndo` (`undo.tsx`, rules in `pendingDelete.ts`).
  For small things (a note, a pantry item, one of our sites). Asking first,
  for one-way or big things: `askFirst` (`askFirst.ts`), never
  `window.confirm`; it works outside React too. Deleting recipes: `confirmDelete` / `deleteRecipes` (`recipeDeletion.ts`;
  the question from `deleteQuestion`, `deleteWarning.ts`).
- Going back a page from a button (the top bar's ‹, the shelves' Done):
  `useGoBack` (`useGoBack.ts`): back where you came from, or up a level
  (`parentOf`, `pageParents.ts`) with nothing in the app to go back to.
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
  `isOffline` (`offline.ts`); `<OfflineNote>` to say so (both add the
  Tailscale reminder for a Tailscale address, `viaTailscale` in
  `tailscale.ts`). A failed call's
  status (404, 409…): `statusOf(err)` (`errorStatus.ts`), never a cast.
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

- A file's or photos' size in words ("18 MB", "800 KB"): `sizeText`
  (`format.ts`).
- Reading a number in recipe text: `NUMBER`, `parseNumber`, `amountRange`
  (`weights.ts`; `NUMBER` is also what `stepAmounts.ts` and `scaling.ts`
  read with). Showing one in kitchen fractions: `kitchenFraction`
  (`scaling.ts`).
- Scaling: `scaleLine`, `servingsCount` (`scaling.ts`); remembered size:
  `recipeScale.ts`; remembered ticks while cooking: `recipeTicks.ts`.
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
- A recipe's copy: `copyOf` (`recipeCopy.ts`), its step photos by
  `photoStepsFor`. Room for more photos and what adding them says:
  `photoRoom` / `photosAddedText` (`recipePhotos.ts`). A pantry place
  renamed, merged or put back: `renamedPlaces` / `unrenamedPlaces` /
  `withPlaceBack` (`pantryGroups.ts`).
- Recipes with the same name: `sameTitle`, `twinLabels` (`recipeTwins.ts`);
  "already imported": `alreadyHave` (`paprikaImport.ts`).
- Words on screen the US spells differently (favourite, colour, grey):
  `useSpell()` (`household.ts`), the word list in `spelling.ts`.

## Photos and files

- Showing a recipe or pantry photo: `<RecipePhoto>`, or `<KeptImg>` /
  `useKeptPhoto` (`KeptPhotos.tsx`) for any other one, so it shows its copy
  kept on the phone when offline (photoCache.ts, Settings' "Keep photos
  for offline"). A plain `<img>` of a server photo goes blank offline.
  Photos inside buttons (a gallery, step photos): `useGaveUpPhotos` with
  their `onGaveUp`, so a photo that won't come hides its button too.

- Shrinking any photo before upload: `shrinkPhoto` (`pantryPhoto.ts`; pass
  `PHOTO_SIDE` from `recipePhotos.ts` for recipes; a website import's
  photos are shrunk after saving, `shrinkSavedPhotos` in `recipeImport.ts`).
  Profile pictures: `squarePicture` (`avatarImage.ts`).
- Photo addresses: `recipeImageUrl`, `recipePhotoUrl`, `pantryPhotoUrl` (`pb.ts`).
- Saving a file (download, or Android's "save as"): `startFile`
  (`saveFile.ts`); Paprika exports `savePaprikaFile` (`paprikaSave.ts`).

## Screen pieces

- A link that opens a recipe site (Bento's own browser in the app, saving
  what's saved there; a new tab elsewhere): `<SiteLink>` with
  `useSiteOpener()`, whose `status` shows the saving and "already here"
  (`SiteOpener.tsx`).
- Any date box: `<DateField>` (`DateField.tsx`), never `<input type="date">`;
  its month grid and typed-date reading are `calendar.ts`.
- A `<dialog className="sheet">` opened while it's on screen:
  `useModalSheet(dialogRef, onClose)` (`useModalSheet.ts`), whose handler
  goes on the dialog's `onClose` (it ignores the late close event that made
  sheets shut as they opened in `npm run dev`).
- `?` tips: `useHelp` / `HelpButton` / `HelpBox` (`Help.tsx`; `HelpButton`
  takes `children` and `className` for a bubble opened by something other
  than a "?", like the connection indicator). A page title's "?", beside
  the h1 but outside it: `<TitleWithHelp help={…}>` (`Help.tsx`). The
  phone's "reduce motion": `lessMotion()` (`motion.ts`). Icons:
  `icons.tsx`. Open/closed sections: `DrawerToggle.tsx`. Photos full screen:
  `PhotoViewer.tsx`. Screen stays on: `useKeepAwake(active)` while
  something runs (the timers), `useWakeLock` for the menu's switch
  (`useWakeLock.ts`). A pantry level (Have /
  Low / Out) as a picture: `LevelJar` (`icons.tsx`). A recipe without a
  photo: `<RecipeStandIn>` (`RecipeStandIn.tsx`), never an emoji. A bento
  tray (things that belong together): the `--rim` / `--rim-text` colours,
  a 5px rim around compartments of `--surface` with 8px corners; see the
  recipe box, pantry places, shopping list, plan and tab bar in
  `styles/`, and docs/VISION.md "Bento trays" for where they go.
- "Label" means two things: on screen, a packet in stock (its "label" chip,
  docs/VISION.md); in code, also a group's display text (`packetGroups`'
  `.label`). A packet's brand and size as words: `packetName`
  (`pantryPackets.ts`).
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
  a date box: `<DateDialog>` (`DateField.tsx`). A page's title as a menu
  of its places or lists, with "Edit …" (the pantry's places, the shopping
  lists): `<TitlePicker>` (`TitlePicker.tsx`). Moving one thing to
  where another is, as dragging does (shelves, places): `moved`
  (`listOrder.ts`), and a grip's "Move up / Move down" `upDownMoves`. A
  drag grip that also opens a menu of moves on a tap or Enter (for anyone
  who can't drag): `<GripMenu>` (`GripMenu.tsx`), whose `DndContext` takes
  `gripKeys` and `gripInstructions` (`dragWords.ts`); a small menu placed from its button
  and closed on a tap outside (the recipe's ⋯ too): `usePopMenu`
  (`usePopMenu.ts`, panel `menu-panel pop-menu`); a `role="menu"` panel's
  keys (first item on open, arrows, Escape back to its button):
  `useMenuKeys` (`menuKeys.ts`, which usePopMenu and the ⋮ menu use); what a screen reader hears while dragging, in names
  rather than ids: every `DndContext` passes `accessibility={{
  announcements: dragAnnouncements(...) }}` (`dragWords.ts`). A message
  with a second button: `showToast(text, { action, extra })`. A passing
  message a screen reader should hear (a bar's or toast's words, which
  carry no role themselves): `announce(text)` (`announce.ts`, read out by
  `<Toaster />`'s live regions). A bar with a button that goes by itself
  waits while touched or focused: `useHoldWhileTouched(bar, hold,
  release)` (`undo.tsx`; pointer and focus counted apart, and a new `bar`
  starts unheld). An item's quick card:
  `<PantryCard>`. Packet rules (`pantryPackets.ts`): a packet as saved or
  put back `packetToSave`, the last one making it Out `lastPacketRunsOut`,
  what adding one changes on the item `itemAfterPacket` / `learnsBarcode`.

## Styles (`web/src/styles/`)

- One stylesheet per screen, loaded by `main.tsx` in a fixed order: `base`
  (colours, type, and the pieces every screen shares: buttons, forms,
  cards, trays, sheets, chips, help), `shell` (top bar, menu, tab bar,
  timer tray, toasts), then `fridge`, `browse`, `shopping`, `plan`,
  `pantry`, `recipe-list`, `recipe`, `dates`, `settings`, `print`.
- Words only screen readers hear (a label beside a number that's
  announced on its own): `.screen-reader-only` (`base.css`).
- A control smaller than 44 px to tap: add it to the two `:where(...)`
  lists under "44 px to tap" in `base.css` and set `--tap-x` / `--tap-y`
  to at most half the gap to its neighbour (an invisible `::before`; not
  for inputs or selects, nor inside a box that clips). A size that holds
  text: `max(<px>, calc(<em> * var(--text-zoom, 1)))`, so it looks the
  same and grows with the phone's text size. Android's web view enlarges
  font sizes but not rem/em in other lengths; `--text-zoom` (textZoom.ts,
  set at start) is that enlargement, 1 in browsers. Check big text on the
  emulator at `font_scale 2.0`, not by enlarging a browser's root font.
- A screen's styles go in its own file. A new piece two screens use goes
  in `base.css`, not a copy in each. Some older shared pieces still live
  in the file of the screen they began on, among them: tag chips
  (`.tag-chip`), the no-photo box (`.stand-in`) and the quick-recipe mark
  (`.quick-time`) in `recipe-list.css`; site rows (`.site-list`,
  `.site-row`) in `browse.css`; the pantry dot beside an ingredient
  (`.status-dot`) in `recipe.css`; the drag handle (`.drag-handle`) and
  the gathered-ingredients list (`.week-list`) in `plan.css`; list
  dividers (`.divider-label`) in `shopping.css`; store logos
  (`.store-logo`) in `pantry.css`. So grep for a class before assuming
  where it is.
- The order matters: when two rules of the same weight style one element,
  the later file wins. So a screen's rule can adjust a piece from
  `base.css` (`.pantry-card-actions > .button`), but a rule in `base.css`
  can't out-vote a screen's, and a rule in an earlier screen's file can't
  out-vote a piece kept in a later one (`plan.css` adjusts `.stand-in`
  only with a heavier selector, `.dinner-slot .stand-in`). Don't reorder
  the imports or move a rule to another file without checking what it
  then loses to or beats. Every stylesheet is imported in `main.tsx`,
  nowhere else.
- After a change that should look the same (moving, merging or tidying
  rules), or to see exactly what a restyle touches: `npm run style-check`
  (in `web`; `web/scripts/style-check.mjs`). It lists what differs between
  the committed stylesheets and the files as they are; `-- --quick` for
  phone width in light only, `-- --from <commit or tag>` for another
  starting point. How it works: it builds the app into a temporary folder
  and opens every screen in a hidden Edge or Chrome
  (`headlessBrowser.mjs`), each of four passes (phone and desktop width,
  light and dark) on its own throwaway server with the sandbox's made-up
  household. On each screen it reads every element's styles under the old
  stylesheets, then the new, on the very same elements; then again with
  everything that folds open opened, after each tap in its `OPENERS`, and
  three more times under a device setting (`SPECIAL_LOOKS`: the recipe
  page printed, the fridge and the plan with less motion). `@keyframes`
  are compared as text, and a relative font or picture address the build
  couldn't find stops it.
  - A new screen gets a line in its `ROUTES`; a new sheet, menu or editor
    its opening taps in `OPENERS`; made-up data only one screen needs, a
    line in its `seed`.
  - It can't see: hover and keyboard-focus looks; a drag in progress, or
    anything else only on screen mid-gesture (the plan's bin, a peeling
    fridge note), in any look; anything behind a tap that isn't in
    `OPENERS`; widths other than 370, 400 and 1200 px; the app's own Light /
    Dark choice (it switches the device's setting, which Auto follows; a
    dark block nested inside another block, which only Auto would reach,
    is refused by web/test/themeBlocks.test.ts);
    whether a font really loads (an absolute address that's wrong passes).
  - Its made-up pantry is marked so no item looks for its photo online:
    nothing in a run may wait on Open Food Facts or a store's website.
  - It ends with 0 for no difference, 1 for differences, 2 when it
    couldn't run or a screen was still loading when looked at. Taps that
    found nothing to tap are listed, never hidden.

## Scripts (`web/scripts/`)

- The Pi: `piConfig` (address, key, `sshOptions`), `onPi` to run a command
  there, `SSH` / `SCP` (`piConfig.mjs`). Only committed code goes out:
  `refuseUncommittedCode` (`committed.mjs`). All checks before sending:
  `runTests` (`tests.mjs`). Android builds with the right Java: `run`
  (`buildTools.mjs`).
- A made-up household on a throwaway server: `fillSandbox(api)`
  (`sandbox-fill.mjs`, the data in `sandbox-data.mjs`), with `sandboxCall`
  for one more request and `sandboxDay` for a date some days from today.
  The sandbox and the style check both use it; a script that needs a
  filled server does too, adding only what it alone needs.
- A throwaway PocketBase (a temporary folder, never `server/pb_data`,
  `--automigrate=false`): `startTestServer({ port, prefix })`
  (`testServer.mjs`), which waits until it answers, notices one that quit
  as it started, and gives back `stop()` (ends it, deletes its folder,
  never throws). `portFree(port)` for "is anything there?". The tests, the
  sandbox and the style check all start theirs with it.
- A hidden browser without a browser package: `openBrowser(folder)`
  (`headlessBrowser.mjs`): `open(url, ready)` for a fresh load that waits
  until the screen has finished fetching, `evaluate`, `send`.

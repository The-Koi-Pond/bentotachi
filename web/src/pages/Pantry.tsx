// The pantry page: a find-or-add box, filters, and a card per place (Simple
// or Detailed rows). The rows, forms and scanning screens are their own
// files (PantryRow, PantryForms, PantryScan); the sorting rules are in
// pantryGroups.ts.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import {
  errorMessage,
  pantryItems,
  pantryPackets,
  pb,
  shoppingItems,
  type PantryItem,
  type PantryPacket,
  type PantryStatus,
  type ShoppingItem,
} from "../pb";
import { useUndo } from "../undo";
import { showError, showToast } from "../toast";
import { UNDO_SECONDS } from "../pendingDelete";
import {
  detailsFor,
  itemAfterPacket,
  justBought,
  knowsBarcode,
  lastPacketRunsOut,
  learnsBarcode,
  packetLabel,
  packetToSave,
  packetsOf,
  tidySize,
  withDetails,
  type PacketDetails,
} from "../pantryPackets";
import { noteAge } from "../fridgeDoor";
import DrawerToggle from "../DrawerToggle";
import { ChevronIcon } from "../icons";
import { useLiveRecords } from "../useLiveRecords";
import { BenMood } from "../Brand";
import { itemWithBarcode, normaliseBarcode, withBarcode } from "../barcodes";
import { canScan, lookUpBarcode, scanBarcode, type BarcodeProduct } from "../scanner";
import { placeOf } from "../pantryItem";
import { groupItems, matchesPantrySearch, needsChecking, needsUsingSoon, norm } from "../pantryGroups";
import { useOnlinePhotos } from "../pantryPhoto";
import PantryRow, { type PantryLayout } from "../PantryRow";
import PantryCard from "../PantryCard";
import { ScanResult } from "../PantryScan";
import { AddPantryItem, EditPantryItem, type Scanned } from "../PantryForms";
import { confirmDiscard, hasUnsavedChanges } from "../unsavedChanges";
import { askFirst } from "../askFirst";
import { remember, remembered, rememberedJson } from "../phoneStorage";
import { onTheList } from "../shoppingMatch";

// The same empty list each time, so the photo filler doesn't re-run while
// the pantry is loading.
const NO_ITEMS: PantryItem[] = [];

type Filter = "all" | "low" | "out" | "soon";

// Simple or Detailed (see PantryRow), remembered for each person on this
// device; everyone starts in Simple, since Bentotachi never pushes
// stock-taking (docs/VISION.md).
const layoutKey = () => `bento.pantryLayout.${pb.authStore.record?.id ?? ""}`;
function savedLayout(): PantryLayout {
  return remembered(layoutKey()) === "detailed" ? "detailed" : "simple";
}

// The places (Cupboard, Fridge…) closed on this device. Storage can be
// missing or refuse; then every place just starts open.
const CLOSED_PLACES_KEY = "bento.closedPantryPlaces";
function savedClosedPlaces(): Set<string> {
  const saved = rememberedJson(CLOSED_PLACES_KEY);
  return new Set(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string") : []);
}
function saveClosedPlaces(closed: Set<string>) {
  remember(CLOSED_PLACES_KEY, JSON.stringify([...closed]));
}

export default function Pantry() {
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const shopping = useLiveRecords<ShoppingItem>("shopping_items");
  // Not waited for: a server from before packets (a friend's older copy)
  // hasn't any, and the pantry works without them (packets.items stays null,
  // and nothing offers to add one).
  const packets = useLiveRecords<PantryPacket>("pantry_packets");
  // A finished packet waits a few seconds for Undo before it's deleted.
  const undo = useUndo();
  const [layout, setLayout] = useState<PantryLayout>(savedLayout);
  const [filter, setFilter] = useState<Filter>("all");
  // What's typed in the find-or-add box: filters the pantry, and names the
  // new item if Add is tapped.
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const startAdding = useCallback(() => setAdding(true), []);
  // The name the add form starts with (what was typed in the find box).
  const [startName, setStartName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  // The item whose quick card is open under its row (PantryCard.tsx).
  const [cardId, setCardId] = useState<string | null>(null);
  // Something that just ran out (setStatus): "Put it on the shopping list?"
  // when it isn't on it (`ask`), and Undo when its packets were cleared
  // (`restore`). Stays until answered, or until something else runs out;
  // with only Undo to offer, it goes after a few seconds.
  const [runOut, setRunOut] = useState<{
    item: PantryItem;
    message: string;
    ask: boolean;
    restore?: (to?: PantryStatus) => Promise<void>;
  } | null>(null);
  // The places closed on this device (remembered, so they stay closed);
  // every other place starts open.
  const [closedPlaces, setClosedPlaces] = useState<Set<string>>(savedClosedPlaces);
  // A store product page to add as a new item, shared to Bento from another
  // app ("#/pantry?add=<link>").
  const [fromStore, setFromStore] = useState<{ url: string; name: string } | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [editingScanned, setEditingScanned] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedStoreLink = searchParams.get("add");

  // Opening a different add form (or a scan) throws away the one on screen;
  // with unsaved changes in it, ask first. `replaces`: whether it would.
  const okToReplaceForm = async (replaces: boolean) => !replaces || confirmDiscard(hasUnsavedChanges());
  // The add form is on screen (an empty pantry always shows it).
  const addFormOpen = adding || pantry.items?.length === 0;

  // A store product page shared to Bentotachi ("#/pantry?add=<link>"): a
  // new item from it.
  useEffect(() => {
    if (!sharedStoreLink) return;
    // Out of the address, so going back doesn't open the form again.
    setSearchParams({}, { replace: true });
    const replaces = !!scanned || addFormOpen;
    const name = searchParams.get("name") ?? "";
    void okToReplaceForm(replaces).then((ok) => {
      if (!ok) return;
      setFromStore({ url: sharedStoreLink, name });
      setStartName("");
      setScanned(null);
      setAdding(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedStoreLink]);

  function changeLayout(next: PantryLayout) {
    setLayout(next);
    remember(layoutKey(), next);
  }

  const waiting = useMemo(() => (shopping.items ?? []).filter((item) => !item.checked), [shopping.items]);
  const isOnList = (item: PantryItem) => onTheList(item, waiting);

  // Run out with only Undo to offer (it's on the list already, or someone
  // has put it there since it asked): that goes by itself too, like other
  // Undos.
  const onlyUndo = !!runOut && (!runOut.ask || isOnList(runOut.item));
  useEffect(() => {
    if (!runOut || !onlyUndo) return;
    const timer = window.setTimeout(() => setRunOut((current) => (current === runOut ? null : current)), UNDO_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [runOut, onlyUndo]);
  // Less any just removed (Undo can still bring them back).
  const items = pantry.items?.filter((item) => !undo.hidden.has(item.id));
  // Photos found online (Open Food Facts, store links), for items that
  // don't have one yet.
  useOnlinePhotos(items ?? NO_ITEMS);

  const loadError = pantry.loadError || shopping.loadError;
  if (!items || !shopping.items) return loadError ? <p className="error">{loadError}</p> : <p className="muted">Counting the tins…</p>;

  // `also`: sent with the change but not kept (see setStatus). Whether it saved.
  async function save(item: PantryItem, patch: Partial<PantryItem>, movedTo: string, also = {}) {
    // Says where it went when it moved drawers ("Opened", or running out).
    if (movedTo) showToast(movedTo);
    pantry.upsert({ ...item, ...patch });
    try {
      await pantryItems().update(item.id, { ...patch, ...also });
      return true;
    } catch (err) {
      pantry.upsert(item);
      showError(errorMessage(err));
      return false;
    }
  }

  // Something running out isn't put on the shopping list by itself: it may
  // not be wanted again for a while, so this asks. The
  // server would add it for apps from before this; ask_about_list tells it
  // this one asks (pantry.pb.js). An opened one that runs out goes back to
  // its own place, for the next unopened one.
  // Out also clears its packets in stock (the server does that, pb_hooks/
  // pantry.pb.js), with Undo to put them back. `lastPacket`: it's out
  // because its last packet was just finished.
  function setStatus(item: PantryItem, status: PantryStatus, lastPacket = false) {
    if (item.status === status) return;
    // Back from Out while its Undo is still offered (Out picked by mistake,
    // then Have): that is the Undo, so its packets come back too. Only while
    // it's still Out: back in stock another way (a packet added, another
    // phone) and the Undo is gone from the screen.
    if (status !== "out" && item.status === "out" && runOut?.item.id === item.id && runOut.restore) {
      void runOut.restore(status);
      return;
    }
    const runsOut = status === "out";
    const putBack = runsOut && item.opened;
    const place = item.location.trim();
    // A packet finished a moment ago stays finished (its Undo goes), so
    // this Undo only brings back what Out cleared.
    if (runsOut) void undo.settle();
    const cleared = runsOut ? packetsOf(packets.items ?? [], item.id, undo.hidden) : [];
    const outWords = lastPacket
      ? `That was the last one: ${item.name} is out.`
      : cleared.length
        ? `${item.name} is out, so its ${cleared.length === 1 ? "packet is" : `${cleared.length} packets are`} cleared.`
        : `${item.name} is out.`;
    const moved =
      putBack && norm(placeOf(item).location) !== norm(place)
        ? `${outWords} It's back in ${place ? `the ${place}` : "Other"}, ready for the next one.`
        : "";
    const ask = runsOut && !isOnList(item);
    // Set just below, before Undo can be tapped.
    let outSaved: Promise<boolean> = Promise.resolve(false);
    // Undo: the status it had (or `to`, picked instead), and its packets.
    // It waits for the Out to reach the server first, or a slow Out could
    // arrive after it and clear the packets again.
    const restore = cleared.length
      ? async (to: PantryStatus = item.status) => {
          setRunOut(null);
          if (!(await outSaved)) return;
          if (!(await save(item, { status: to, opened: !!item.opened }, ""))) return;
          try {
            for (const packet of cleared) packets.upsert(await pantryPackets().create(packetToSave(packet)));
          } catch (err) {
            showError(errorMessage(err));
          }
        }
      : undefined;
    if (ask || restore) setRunOut({ item, ask, restore, message: moved || outWords });
    // The server clears them; off the screen straight away.
    for (const packet of cleared) packets.removeLocally(packet.id);
    outSaved = save(item, putBack ? { status, opened: false } : { status }, ask || restore ? "" : moved, runsOut ? { ask_about_list: true } : {});
    void outSaved.then((saved) => {
      if (saved) return;
      // Didn't save: its question goes (not another item's asked since),
      // and its packets are still there.
      setRunOut((current) => (current?.item.id === item.id ? null : current));
      for (const packet of cleared) packets.upsert(packet);
    });
  }

  // A packet bought or found: on the item (itemAfterPacket says what that
  // changes on it). Whether the packet was added. Within a few hours of the
  // shopping list adding one to it (ticked bought), this is likely the same
  // bag being put away, so it asks first.
  async function addPacket(item: PantryItem, details: PacketDetails, barcode = ""): Promise<boolean> {
    const remember = learnsBarcode(item, barcode, details);
    const bought = justBought(packetsOf(packets.items ?? [], item.id, undo.hidden));
    if (
      bought &&
      !(await askFirst(
        `The shopping list already added ${packetLabel(bought)} of ${item.name} ${noteAge(bought.created, new Date())}, when it was ticked bought. Unless you bought two, that's probably this one.`,
        { yes: "I bought two", no: "It's the same one" }
      ))
    ) {
      // The same bag: nothing added, but a scanned barcode is still learned.
      if (remember) await save(item, { barcode_details: withDetails(item, barcode, details) }, "");
      return false;
    }
    try {
      packets.upsert(
        await pantryPackets().create(packetToSave({ item: item.id, brand: details.brand.trim(), size: details.size.trim(), barcode })),
      );
    } catch (err) {
      showError(errorMessage(err));
      return false;
    }
    const changes = itemAfterPacket(item, barcode, details);
    if (changes) await save(item, changes, "");
    return true;
  }

  // A scanned packet of something already in the pantry: its brand and size
  // are what the item remembers for the barcode, or else what Open Food
  // Facts says (asked once).
  async function addScannedPacket(item: PantryItem, code: string): Promise<boolean> {
    let looked: BarcodeProduct | null = null;
    if (!knowsBarcode(item, code)) {
      try {
        looked = scanned?.code === code && scanned.product ? scanned.product : await lookUpBarcode(code);
      } catch {
        // Not known, or no connection: a packet without a brand or size.
      }
    }
    return addPacket(item, detailsFor(item, code, looked), code);
  }

  // Finished: tapping a packet. The last one makes the item Out (and asks
  // about the shopping list); others, and one on an item already Out (a
  // dropped connection can leave one), wait a few seconds for Undo.
  function finishPacket(item: PantryItem, packet: PantryPacket) {
    if (lastPacketRunsOut(item, packetsOf(packets.items ?? [], item.id, undo.hidden))) {
      setStatus(item, "out", true);
      return;
    }
    undo.offer([packet.id], `Finished: ${packetLabel(packet)} of ${item.name}.`, async () => {
      try {
        await pantryPackets().delete(packet.id);
        packets.removeLocally(packet.id);
      } catch (err) {
        // Already gone (the item ran out meanwhile, clearing it) is fine.
        if ((err as { status?: number }).status !== 404) showError(errorMessage(err));
      }
    });
  }

  function setOpened(item: PantryItem, opened: boolean) {
    const moved = placeOf({ ...item, opened }).location.trim();
    void save(item, { opened }, `${item.name} is now in ${moved ? `the ${moved}` : "Other"}.`);
  }

  async function addToList(item: PantryItem) {
    try {
      shopping.upsert(
        await shoppingItems().create({ text: item.name, checked: false, pantry_item: item.id, added_by: pb.authStore.record?.id })
      );
    } catch (err) {
      showError(errorMessage(err));
    }
  }

  // A barcode from the scanner or the barcode box: shows the item it belongs
  // to, or looks it up to start a new one.
  // Typed numbers aren't misread, and a scan matching the last one is sure.
  async function takeBarcode(text: string, typed = false) {
    const code = normaliseBarcode(text);
    if (!code) {
      showError("That doesn't look like a barcode (8 to 14 digits).");
      return;
    }
    // A scan replaces the add form, or the last scan's screen (even of the
    // same barcode: its form starts again).
    if (!(await okToReplaceForm(addFormOpen || !!scanned))) return;
    setAdding(false);
    setFromStore(null);
    setEditingScanned(false);
    const known = !!itemWithBarcode(items ?? [], code);
    const sure = typed || scanned?.code === code;
    setScanned({ code, looking: !known, product: null, lookupError: "", sure });
    if (known) return;
    let product: BarcodeProduct | null = null;
    let lookupError = "";
    try {
      product = await lookUpBarcode(code);
    } catch (err) {
      lookupError = errorMessage(err);
    }
    setScanned((current) => (current?.code === code ? { ...current, looking: false, product, lookupError } : current));
  }

  async function scan() {
    try {
      const code = await scanBarcode();
      if (code) await takeBarcode(code);
    } catch (err) {
      showError(errorMessage(err));
    }
  }

  // A scanned packet of something already in the pantry (maybe another
  // brand of it): the barcode goes on that item, remembering its brand and
  // size. The favourite brand stays as it is: only people pick that. Then
  // the scan shows that item, offering "Add this packet".
  async function addBarcodeTo(item: PantryItem, code: string, brand: string) {
    try {
      pantry.upsert(
        await pantryItems().update(item.id, {
          barcodes: withBarcode(item, code),
          barcode_details: withDetails(item, code, { brand, size: tidySize(scanned?.product?.quantity ?? "") }),
        })
      );
    } catch (err) {
      showError(errorMessage(err));
    }
  }

  // Gone at once, with Undo, rather than a question first. Whether it was
  // removed (always, now: a failed delete brings it back with an error).
  async function remove(item: PantryItem): Promise<boolean> {
    setEditingId(null);
    undo.offer([item.id], `Removed “${item.name}”.`, async () => {
      pantry.removeLocally(item.id);
      try {
        await pantryItems().delete(item.id);
      } catch (err) {
        showError(errorMessage(err));
        pantry.reload();
      }
    });
    return true;
  }

  // The find-or-add box's Add (or Enter): a new item named what was typed.
  // A barcode number instead (typed, or a USB scanner's, which types it and
  // presses Enter) looks the barcode up, like scanning.
  async function findOrAdd(event: FormEvent) {
    event.preventDefault();
    const typed = query.trim();
    if (/^[\d\s-]+$/.test(typed) && normaliseBarcode(typed)) {
      setQuery("");
      void takeBarcode(typed, true);
      return;
    }
    // The same name again keeps the form that's open.
    if (!(await okToReplaceForm(!!scanned || (addFormOpen && (!!fromStore || typed !== startName))))) return;
    setQuery("");
    setScanned(null);
    setFromStore(null);
    setStartName(typed);
    setAdding(true);
  }

  const ranOut = runOut && items.find((i) => i.id === runOut.item.id);
  // The question goes once someone puts it on the list; Undo stays.
  const asking = !!runOut?.ask && !!ranOut && !isOnList(ranOut);
  const stillAsking = !!runOut && ranOut?.status === "out" && (asking || !!runOut.restore);

  const lowCount = items.filter((i) => i.status === "low").length;
  const outCount = items.filter((i) => i.status === "out").length;
  const soonCount = items.filter((i) => needsUsingSoon(i)).length;
  const shown = items.filter(
    (i) =>
      (filter === "all" ? true : filter === "soon" ? needsUsingSoon(i) : i.status === filter) && matchesPantrySearch(i, query),
  );
  const groups = groupItems(shown);
  // A scanned barcode brings its own form (see ScanResult).
  const showForm = !scanned && (adding || items.length === 0);

  // A filter or a search shows its (short) results with every place open.
  const narrowed = filter !== "all" || !!query.trim();
  // Places start open, and the ones you close stay closed on this device
  // (2026-11-06; they used to all start closed on every visit).
  const isOpen = (key: string) => narrowed || !closedPlaces.has(key);
  const closePlaces = (next: Set<string>) => {
    setClosedPlaces(next);
    saveClosedPlaces(next);
  };
  const toggleDrawer = (key: string) => {
    const next = new Set(closedPlaces);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    closePlaces(next);
  };
  const allDrawerKeys = groups.map((g) => g.key);
  const allOpen = allDrawerKeys.length > 0 && allDrawerKeys.every((key) => !closedPlaces.has(key));

  return (
    <div className="stack narrow">
      <div className="section-head">
        <h1>Pantry</h1>
        <div className="view-switch" role="group" aria-label="Layout">
          <button aria-pressed={layout === "simple"} onClick={() => changeLayout("simple")}>
            Simple
          </button>
          <button aria-pressed={layout === "detailed"} onClick={() => changeLayout("detailed")}>
            Detailed
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <form className="add-row joined" role="search" onSubmit={findOrAdd}>
          <span className="find-box">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={canScan ? "Find or add, like “flour”" : "Find or add, or type a barcode"}
              aria-label="Find in the pantry, or the name of something to add"
              autoComplete="off"
              enterKeyHint="go"
            />
            {query && (
              <button type="button" className="find-clear" aria-label="Clear" onClick={() => setQuery("")}>
                ✕
              </button>
            )}
            {canScan && (
              <button type="button" className="find-scan" aria-label="Scan a barcode" title="Scan a barcode" onClick={() => void scan()}>
                <span aria-hidden="true">📷</span>
              </button>
            )}
          </span>
          <button className="button primary">Add</button>
        </form>
      )}

      {scanned && (
        <ScanResult
          scanned={scanned}
          items={items}
          editing={editingScanned}
          isOnList={isOnList}
          onEdit={setEditingScanned}
          onStatus={setStatus}
          onOpened={setOpened}
          onAddToList={addToList}
          onScanAgain={() => void scan()}
          onSure={() => setScanned({ ...scanned, sure: true })}
          onAdded={(item) => pantry.upsert(item)}
          onSaved={(item) => {
            pantry.upsert(item);
            setEditingScanned(false);
          }}
          onDelete={(item) => void remove(item).then((removed) => removed && setScanned(null))}
          onAddBarcodeTo={(item, brand) => void addBarcodeTo(item, scanned.code, brand ?? scanned.product?.brand ?? "")}
          packetsFor={packets.items && ((item) => packetsOf(packets.items ?? [], item.id, undo.hidden))}
          onAddScannedPacket={(item) => addScannedPacket(item, scanned.code)}
          onFinishPacket={finishPacket}
          onAddTypedPacket={addPacket}
          onClose={() => setScanned(null)}
        />
      )}

      {showForm && (
        <AddPantryItem
          // A fresh form for each store page or typed name, filled in from it.
          key={fromStore?.url ?? `name:${startName}`}
          existing={items}
          fromStore={fromStore}
          startName={startName}
          onScan={canScan && items.length === 0 ? () => void scan() : undefined}
          onAdded={(item) => {
            pantry.upsert(item);
            setFromStore(null);
          }}
          // An empty pantry shows the form by itself; once it's being filled
          // in, it stays even if a housemate's first item arrives meanwhile.
          onStartedTyping={startAdding}
          onClose={
            items.length > 0
              ? () => {
                  setAdding(false);
                  setFromStore(null);
                }
              : undefined
          }
        />
      )}

      {items.length === 0 ? (
        <div className="with-ben">
          <BenMood mood="sweat" small />
          <p className="muted">
            An empty pantry. Ben has some concerns. Add what you keep on hand, from fridge essentials to cupboard
            staples.
          </p>
        </div>
      ) : (
        <div className="filter-chips pantry-filters" role="group" aria-label="Show">
          {(
            [
              ["all", "All", items.length],
              ["low", "Low", lowCount],
              ["out", "Out", outCount],
              ["soon", "Use soon", soonCount],
            ] as [Filter, string, number][]
          ).map(([value, label, count]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              className={value !== "all" && count > 0 ? "has-some" : undefined}
              onClick={() => setFilter(value)}
            >
              {label} <span className="filter-count">{count}</span>
            </button>
          ))}
          {!narrowed && (
            <button
              className={`open-all ${allOpen ? "all-open" : ""}`}
              aria-label={allOpen ? "Close all places" : "Open all places"}
              title={allOpen ? "Close all places" : "Open all places"}
              onClick={() => closePlaces(allOpen ? new Set(allDrawerKeys) : new Set())}
            >
              <ChevronIcon />
            </button>
          )}
        </div>
      )}

      {/* Gone by itself once it's no longer out, or someone puts it on the
          list meanwhile. */}
      {stillAsking && (
        <p className="toast undo-toast" role="status">
          <span>
            {runOut.message}
            {asking && " Put it on the shopping list?"}
          </span>
          <span className="toast-actions">
            {asking && (
              <>
                <button
                  className="link-button"
                  onClick={() => {
                    void addToList(runOut.item);
                    setRunOut(null);
                  }}
                >
                  Add it
                </button>
                <button className="link-button" onClick={() => setRunOut(null)}>
                  Not now
                </button>
              </>
            )}
            {runOut.restore && (
              <button className="link-button" onClick={() => void runOut.restore?.()}>
                Undo
              </button>
            )}
          </span>
        </p>
      )}
      {undo.toast}
      {items.length > 0 && shown.length === 0 && (
        <p className="muted">
          {query.trim()
            ? `No “${query.trim()}” in the pantry${filter === "all" ? "" : " with that filter"}, unless it's hiding behind the rice. Tap Add to put it in.`
            : `${filter === "soon" ? "Nothing needs using up soon." : `Nothing is marked “${filter}”.`} Nice.`}
        </p>
      )}

      {/* One card per place; its subcategories are small headings inside,
          like the shopping list's aisles. */}
      {groups.map((group) => {
        const placeItems = group.subgroups.flatMap((s) => s.items);
        const toCheck = placeItems.filter((i) => needsChecking(i)).length;
        return (
          <section key={group.key} className="pantry-place">
            <h2>
              <DrawerToggle open={isOpen(group.key)} onToggle={() => toggleDrawer(group.key)} className="place-toggle">
                <span className="drawer-label">{group.label}</span>
                <span className="place-count">{placeItems.length}</span>
                {toCheck > 0 && <span className="badge to-check">{toCheck} to check</span>}
              </DrawerToggle>
            </h2>
            {isOpen(group.key) && (
              <ul className="pantry-list">
                {group.subgroups.map((sub) => [
                  // Items with no subcategory come first, without a heading.
                  sub.label && (
                    <li key={sub.key} className="pantry-sublabel divider-label">
                      <span>{sub.label}</span>
                    </li>
                  ),
                  ...sub.items.map((item) => (
                    <li key={item.id}>
                      {editingId === item.id ? (
                        <EditPantryItem
                          item={item}
                          existing={items}
                          packets={packets.items && packetsOf(packets.items, item.id, undo.hidden)}
                          onAddPacket={(details) => addPacket(item, details)}
                          onFinishPacket={(packet) => finishPacket(item, packet)}
                          onSaved={(saved) => {
                            pantry.upsert(saved);
                            setEditingId(null);
                          }}
                          onCancel={() => setEditingId(null)}
                          onDelete={() => remove(item)}
                        />
                      ) : (
                        <>
                          <PantryRow
                            item={item}
                            layout={layout}
                            onList={isOnList(item)}
                            packets={packetsOf(packets.items ?? [], item.id, undo.hidden)}
                            onFinishPacket={(packet) => finishPacket(item, packet)}
                            onAddPacket={(details) => void addPacket(item, details)}
                            expanded={cardId === item.id}
                            onEdit={() => setCardId((open) => (open === item.id ? null : item.id))}
                            onStatus={(status) => setStatus(item, status)}
                            onOpened={(opened) => setOpened(item, opened)}
                            onAddToList={() => addToList(item)}
                          />
                          {cardId === item.id && (
                            <PantryCard
                              item={item}
                              packets={packets.items && packetsOf(packets.items, item.id, undo.hidden)}
                              onMore={(details) => void addPacket(item, details)}
                              onUsed={(packet) => finishPacket(item, packet)}
                              onStatus={(status) => setStatus(item, status)}
                              onEditAll={() => {
                                setCardId(null);
                                setEditingId(item.id);
                              }}
                            />
                          )}
                        </>
                      )}
                    </li>
                  )),
                ])}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

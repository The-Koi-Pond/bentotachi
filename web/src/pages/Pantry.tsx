import { useEffect, useMemo, useRef, useState, type FormEvent, type Ref } from "react";
import { useSearchParams } from "react-router";
import { errorMessage, pantryItems, pb, shoppingItems, type PantryItem, type PantryStatus, type ShoppingItem } from "../pb";
import { CartIcon } from "../icons";
import DrawerToggle from "../DrawerToggle";
import { forEveryone, useSingleUser, useStores } from "../household";
import { daysUntil, describeExpiry, expiryDate, expiryState, toStoredDate, type ExpiryState } from "../expiry";
import { useLiveRecords } from "../useLiveRecords";
import { productNameFromTitle, productNameFromUrl, storeName, storeSearchUrl, type Store } from "../stores";
import { hasBuiltInBrowser, pickPageLink } from "../bentoBrowser";
import { normaliseSiteUrl } from "../recipeSites";
import StoreLink from "../StoreLink";
import StoreLogo from "../StoreLogo";
import { BenMood } from "../Brand";
import { useUnsavedChanges } from "../unsavedChanges";
import { barcodesOf, itemWithBarcode, normaliseBarcode, withBarcode } from "../barcodes";
import { canScan, lookUpBarcode, scanBarcode, type BarcodeProduct } from "../scanner";
import { guessPantryItem } from "../pantryLinks";
import { brandsOf, placeOf, withBrand } from "../pantryItem";

// A barcode just scanned (or typed): what Open Food Facts says it is, once
// looked up (null if it doesn't know), for ones not in the pantry yet.
// The scanner sometimes misreads a digit (giving a number nothing has), so a
// scan nothing has is only believed once it's scanned the same twice, typed,
// or checked against the packet: `sure`.
interface Scanned {
  code: string;
  looking: boolean;
  product: BarcodeProduct | null;
  lookupError: string;
  sure: boolean;
}

const STATUSES: { value: PantryStatus; label: string }[] = [
  { value: "have", label: "Have" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
];

type Filter = "all" | "low" | "out" | "soon";

const norm = (text: string) => text.trim().toLowerCase();

// Expiry only matters for things we still have; once it's out, it's gone.
function itemExpiry(item: PantryItem): ExpiryState | null {
  if (item.status === "out") return null;
  const days = daysUntil(item.expires);
  return days === null ? null : expiryState(days);
}

const needsUsingSoon = (item: PantryItem) => {
  const state = itemExpiry(item);
  return state === "expired" || state === "soon";
};

// Starter places and their subcategories, always offered in the dropdowns.
// Places and subcategories people add themselves come from the items that
// use them, so a subcategory made under "Fridge" is only offered there.
const DEFAULT_PLACES: Record<string, string[]> = {
  Fridge: ["Dairy", "Meat & fish", "Fruit & veg", "Sauces & condiments", "Drinks"],
  Freezer: ["Meat & fish", "Vegetables", "Ready meals", "Desserts"],
  Cupboard: ["Baking", "Spices", "Grains & pasta", "Tins & jars", "Oils & vinegars", "Snacks"],
};

function placeOptions(existing: PantryItem[]): string[] {
  return uniqueLabels([
    ...Object.keys(DEFAULT_PLACES),
    ...existing.flatMap((i) => [i.location, i.opened_location ?? ""]),
  ]);
}

function subcategoryOptions(existing: PantryItem[], place: string): string[] {
  if (!place.trim()) return [];
  const defaults = Object.entries(DEFAULT_PLACES).find(([name]) => norm(name) === norm(place))?.[1] ?? [];
  return uniqueLabels([
    ...defaults,
    ...existing.filter((i) => norm(i.location) === norm(place)).map((i) => i.subcategory),
  ]);
}

interface Fields {
  name: string;
  location: string;
  subcategory: string;
  // "2026-11-02" or "" (the date input's format).
  expires: string;
  // Its product page in a store, as typed or picked; "" for none.
  storeUrl: string;
  // The brands we buy ("Coles, White Mill"), or "".
  brand: string;
  // "3 cans", or "".
  note: string;
  // Where it goes once opened, or "" for nowhere else.
  openedLocation: string;
}

// `key` identifies a drawer for opening/closing: the place, or place/subcategory.
interface Subgroup {
  key: string;
  label: string;
  items: PantryItem[];
}

interface Group {
  key: string;
  label: string;
  subgroups: Subgroup[];
}

// Place -> subcategory -> items. Spelling differences in case ("fridge" vs
// "Fridge") land in the same group. Items with no place go last under
// "Other"; items with no subcategory go first within their place. Opened
// items go in their once-opened place (see placeOf).
function groupItems(items: PantryItem[]): Group[] {
  const places = new Map<string, { label: string; subs: Map<string, { label: string; items: PantryItem[] }> }>();
  for (const item of items) {
    const { location, subcategory } = placeOf(item);
    const placeKey = norm(location);
    if (!places.has(placeKey)) places.set(placeKey, { label: location.trim() || "Other", subs: new Map() });
    const subs = places.get(placeKey)!.subs;
    const subKey = norm(subcategory);
    if (!subs.has(subKey)) subs.set(subKey, { label: subcategory.trim(), items: [] });
    subs.get(subKey)!.items.push(item);
  }

  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  return [...places.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : byName(a, b)))
    .map(([placeKey, place]) => ({
      key: placeKey,
      label: place.label,
      subgroups: [...place.subs.entries()]
        .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : byName(a, b)))
        .map(([subKey, sub]) => ({
          key: `${placeKey}/${subKey}`,
          label: sub.label,
          items: sub.items.sort((x, y) => byName(x.name, y.name)),
        })),
    }));
}

// "8 · 2 low · 1 out · 1 expired", shown on drawer headings so closed
// drawers still say where things need restocking or using up.
function DrawerCounts({ items }: { items: PantryItem[] }) {
  const low = items.filter((i) => i.status === "low").length;
  const out = items.filter((i) => i.status === "out").length;
  const expired = items.filter((i) => itemExpiry(i) === "expired").length;
  const soon = items.filter((i) => itemExpiry(i) === "soon").length;
  return (
    <span className="drawer-counts">
      <span className="muted">{items.length}</span>
      {low > 0 && <span className="badge badge-low">{low} low</span>}
      {out > 0 && <span className="badge badge-out">{out} out</span>}
      {expired > 0 && <span className="badge badge-expired">{expired} expired</span>}
      {soon > 0 && <span className="badge badge-soon">{soon} use soon</span>}
    </span>
  );
}


// Removes blanks and case-only duplicates (the first spelling wins, so the
// starter names keep their capitals), then sorts A to Z.
function uniqueLabels(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) if (value.trim() && !seen.has(norm(value))) seen.set(norm(value), value.trim());
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export default function Pantry() {
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const singleUser = useSingleUser();
  // The household country's stores; none means no store search.
  const stores = useStores();
  const shopping = useLiveRecords<ShoppingItem>("shopping_items");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [searchingStores, setSearchingStores] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Says where an item went when it moved drawers ("Opened", or running out).
  const [notice, setNotice] = useState("");
  // Drawers start closed each visit; this holds the ones opened since.
  const [openDrawers, setOpenDrawers] = useState<Set<string>>(new Set());
  // A store product page to add as a new item: shared to Bento from another
  // app ("#/pantry?add=<link>"), or picked in Search stores.
  const [fromStore, setFromStore] = useState<{ url: string; name: string } | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [editingScanned, setEditingScanned] = useState(false);
  // In a browser: the box for typing a barcode (or a USB scanner's).
  const [typingBarcode, setTypingBarcode] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedStoreLink = searchParams.get("add");

  useEffect(() => {
    if (!sharedStoreLink) return;
    setFromStore({ url: sharedStoreLink, name: searchParams.get("name") ?? "" });
    setAdding(true);
    // Out of the address, so going back doesn't open the form again.
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedStoreLink]);

  // The notice goes away by itself after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const waiting = useMemo(() => (shopping.items ?? []).filter((item) => !item.checked), [shopping.items]);
  const items = pantry.items;

  const loadError = pantry.loadError || shopping.loadError;
  if (!items || !shopping.items) return loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading the pantry…</p>;

  // On the list if it's linked, or someone typed the same name by hand.
  const isOnList = (item: PantryItem) =>
    waiting.some((w) => w.pantry_item === item.id || (!w.pantry_item && norm(w.text) === norm(item.name)));

  async function save(item: PantryItem, patch: Partial<PantryItem>, movedTo: string) {
    setError("");
    setNotice(movedTo);
    pantry.upsert({ ...item, ...patch });
    try {
      await pantryItems().update(item.id, patch);
    } catch (err) {
      pantry.upsert(item);
      setNotice("");
      setError(errorMessage(err));
    }
  }

  // The server puts "out" items on the shopping list by itself. An opened
  // one that runs out goes back to its own place, for the next unopened one.
  function setStatus(item: PantryItem, status: PantryStatus) {
    if (item.status === status) return;
    const putBack = status === "out" && item.opened;
    const place = item.location.trim();
    void save(
      item,
      putBack ? { status, opened: false } : { status },
      putBack && norm(placeOf(item).location) !== norm(place)
        ? `${item.name} is out, so it's back in ${place ? `the ${place}` : "Other"}, ready for the next one.`
        : "",
    );
  }

  function setOpened(item: PantryItem, opened: boolean) {
    const moved = placeOf({ ...item, opened }).location.trim();
    void save(item, { opened }, `${item.name} is now in ${moved ? `the ${moved}` : "Other"}.`);
  }

  async function addToList(item: PantryItem) {
    setError("");
    try {
      shopping.upsert(
        await shoppingItems().create({ text: item.name, checked: false, pantry_item: item.id, added_by: pb.authStore.record?.id })
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // A barcode from the scanner or the barcode box: shows the item it belongs
  // to, or looks it up to start a new one.
  // Typed numbers aren't misread, and a scan matching the last one is sure.
  async function takeBarcode(text: string, typed = false) {
    const code = normaliseBarcode(text);
    setError("");
    setNotice("");
    if (!code) {
      setError("That doesn't look like a barcode (8 to 14 digits).");
      return;
    }
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
    setError("");
    try {
      const code = await scanBarcode();
      if (code) await takeBarcode(code);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // A scanned packet of something already in the pantry (maybe another
  // brand of it): the barcode goes on that item, and the brand joins its
  // brands.
  async function addBarcodeTo(item: PantryItem, code: string, brand: string) {
    setError("");
    try {
      pantry.upsert(
        await pantryItems().update(item.id, { barcodes: withBarcode(item, code), brand: withBrand(item.brand, brand) })
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // Whether it was removed.
  async function remove(item: PantryItem): Promise<boolean> {
    if (!window.confirm(`Remove “${item.name}” from the pantry${forEveryone(singleUser)}?`)) return false;
    setError("");
    try {
      await pantryItems().delete(item.id);
      pantry.removeLocally(item.id);
      setEditingId(null);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }

  const lowCount = items.filter((i) => i.status === "low").length;
  const outCount = items.filter((i) => i.status === "out").length;
  const soonCount = items.filter(needsUsingSoon).length;
  const shown = items.filter((i) =>
    filter === "all" ? true : filter === "soon" ? needsUsingSoon(i) : i.status === filter
  );
  const groups = groupItems(shown);
  // A scanned barcode brings its own form (see ScanResult).
  const showForm = !scanned && (adding || items.length === 0);

  // A Low/Out filter shows its (short) results with every drawer open.
  const filtering = filter !== "all";
  const isOpen = (key: string) => filtering || openDrawers.has(key);
  const toggleDrawer = (key: string) =>
    setOpenDrawers((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allDrawerKeys = groups.flatMap((g) => [g.key, ...g.subgroups.filter((s) => s.label).map((s) => s.key)]);
  const allOpen = allDrawerKeys.length > 0 && allDrawerKeys.every((key) => openDrawers.has(key));

  return (
    <div className="stack narrow">
      <div className="section-head wraps">
        <h1>Pantry</h1>
        <span className="title-actions">
          {canScan ? (
            <button className="button small" onClick={() => void scan()}>
              <span className="button-mark" aria-hidden="true">📷</span> Scan
            </button>
          ) : (
            <button
              className={`button small ${typingBarcode ? "primary" : ""}`}
              onClick={() => setTypingBarcode((open) => !open)}
              aria-expanded={typingBarcode}
            >
              Barcode
            </button>
          )}
          {stores.length > 0 && (
            <button
              className={`button small ${searchingStores ? "primary" : ""}`}
              onClick={() => setSearchingStores((open) => !open)}
              aria-expanded={searchingStores}
            >
              Search stores
            </button>
          )}
          {!showForm && (
            <button className="button small primary" onClick={() => setAdding(true)}>
              + Add item
            </button>
          )}
        </span>
      </div>

      {typingBarcode && !canScan && <BarcodeBox onCode={(code) => void takeBarcode(code, true)} />}

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
          onClose={() => setScanned(null)}
        />
      )}

      {searchingStores && stores.length > 0 && (
        <StoreSearch
          stores={stores}
          onPicked={(picked) => {
            setFromStore(picked);
            setAdding(true);
            setSearchingStores(false);
          }}
        />
      )}

      {showForm && (
        <AddPantryItem
          // A fresh form for each store page, filled in from it.
          key={fromStore?.url ?? "blank"}
          existing={items}
          fromStore={fromStore}
          onAdded={(item) => {
            pantry.upsert(item);
            setFromStore(null);
          }}
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
            Nothing in here yet (it's making someone nervous). Add the things you keep in stock. Group them by where
            they live, like “Fridge” or “Cupboard”, with optional subcategories like “Baking” or “Spices”.
          </p>
        </div>
      ) : (
        <div className="filter-chips" role="group" aria-label="Show">
          {(
            [
              ["all", `All ${items.length}`],
              ["low", `Low ${lowCount}`],
              ["out", `Out ${outCount}`],
              ["soon", `Use soon ${soonCount}`],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
          {!filtering && (
            <button
              className="push-right plain"
              onClick={() => setOpenDrawers(allOpen ? new Set() : new Set(allDrawerKeys))}
            >
              {allOpen ? "Close all" : "Open all"}
            </button>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {notice && (
        <p className="toast" role="status">
          {notice}
        </p>
      )}
      {items.length > 0 && shown.length === 0 && (
        <p className="muted">
          {filter === "soon" ? "Nothing needs using up soon." : `Nothing is marked “${filter}”.`} Nice.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key} className="pantry-group">
          <h2>
            <DrawerToggle open={isOpen(group.key)} onToggle={() => toggleDrawer(group.key)} className="place-toggle">
              <span className="drawer-label">{group.label}</span>
              <DrawerCounts items={group.subgroups.flatMap((s) => s.items)} />
            </DrawerToggle>
          </h2>
          {isOpen(group.key) && (
            <div className="drawer-body">
              {group.subgroups.map((sub) => {
                // Items with no subcategory sit straight inside the place.
                const subOpen = !sub.label || isOpen(sub.key);
                return (
                  <div key={sub.key} className="pantry-subgroup">
                    {sub.label && (
                      <h3>
                        <DrawerToggle open={subOpen} onToggle={() => toggleDrawer(sub.key)} className="sub-toggle">
                          <span className="drawer-label">{sub.label}</span>
                          <DrawerCounts items={sub.items} />
                        </DrawerToggle>
                      </h3>
                    )}
                    {subOpen && (
                      <ul className="pantry-list">
                        {sub.items.map((item) => (
                          <li key={item.id}>
                            {editingId === item.id ? (
                              <EditPantryItem
                                item={item}
                                existing={items}
                                onSaved={(saved) => {
                                  pantry.upsert(saved);
                                  setEditingId(null);
                                }}
                                onCancel={() => setEditingId(null)}
                                onDelete={() => remove(item)}
                              />
                            ) : (
                              <PantryRow
                                item={item}
                                onList={isOnList(item)}
                                onEdit={() => setEditingId(item.id)}
                                onStatus={(status) => setStatus(item, status)}
                                onOpened={(opened) => setOpened(item, opened)}
                                onAddToList={() => addToList(item)}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// In a browser: type a barcode's number, or point a USB barcode scanner at a
// packet (it types the number and presses Enter by itself).
function BarcodeBox({ onCode }: { onCode: (code: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="add-row"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return;
        onCode(text);
        setText("");
      }}
    >
      <input
        aria-label="Barcode"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Barcode number, or use a USB scanner"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <button className="button primary">Find</button>
    </form>
  );
}

// What a scanned barcode is: the pantry item it's on (to mark low or out, or
// edit), or else a new item filled in from Open Food Facts, or the barcode
// put on an item already in the pantry (like another brand of it). A number
// nothing has is checked first, in case the scanner misread it.
function ScanResult({
  scanned,
  items,
  editing,
  isOnList,
  onEdit,
  onStatus,
  onOpened,
  onAddToList,
  onScanAgain,
  onSure,
  onAdded,
  onSaved,
  onDelete,
  onAddBarcodeTo,
  onClose,
}: {
  scanned: Scanned;
  items: PantryItem[];
  editing: boolean;
  isOnList: (item: PantryItem) => boolean;
  onEdit: (editing: boolean) => void;
  onStatus: (item: PantryItem, status: PantryStatus) => void;
  onOpened: (item: PantryItem, opened: boolean) => void;
  onAddToList: (item: PantryItem) => void;
  onScanAgain: () => void;
  onSure: () => void;
  onAdded: (item: PantryItem) => void;
  onSaved: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
  // The brand: the scanned product's unless given.
  onAddBarcodeTo: (item: PantryItem, brand?: string) => void;
  onClose: () => void;
}) {
  const [otherId, setOtherId] = useState("");
  const found = itemWithBarcode(items, scanned.code);

  if (found)
    return (
      <section className="card stack scan-result">
        <div className="section-head">
          <h2>In the pantry</h2>
          <button className="button ghost small" onClick={onClose}>
            Done
          </button>
        </div>
        {editing ? (
          <EditPantryItem
            item={found}
            existing={items}
            onSaved={onSaved}
            onCancel={() => onEdit(false)}
            onDelete={() => onDelete(found)}
          />
        ) : (
          <PantryRow
            item={found}
            onList={isOnList(found)}
            onEdit={() => onEdit(true)}
            onStatus={(status) => onStatus(found, status)}
            onOpened={(opened) => onOpened(found, opened)}
            onAddToList={() => onAddToList(found)}
          />
        )}
      </section>
    );

  if (scanned.looking)
    return (
      <p className="card muted scan-result" role="status">
        Looking up {scanned.code}…
      </p>
    );

  const { product } = scanned;
  if (!product && !scanned.lookupError && !scanned.sure)
    return (
      <section className="card stack scan-result" role="status">
        <h2>Nothing has this number</h2>
        <p className="barcode-number">{scanned.code}</p>
        <p className="muted small-note">
          Scanners sometimes misread a digit, so scan it once more to check. Or check the number against the one under
          the barcode on the packet.
        </p>
        <div className="actions">
          <button className="button ghost small" onClick={onClose}>
            Cancel
          </button>
          <button className="button small" onClick={onSure}>
            It matches
          </button>
          {canScan && (
            <button className="button primary small" onClick={onScanAgain}>
              <span className="button-mark" aria-hidden="true">📷</span> Scan again
            </button>
          )}
        </div>
      </section>
    );

  // An item it's probably another packet of: "Coles Brown Sugar 1kg" ->
  // Brown sugar.
  const likely = product ? guessPantryItem(product.name, items) : null;

  return (
    <>
      {likely && (
        <section className="card stack scan-result">
          <p>
            Is this <strong>{likely.name}</strong>? It's already in the pantry
            {likely.brand || likely.location ? ` (${[likely.brand, likely.location].filter(Boolean).join(", ")})` : ""}.
          </p>
          <div className="actions">
            <button className="button primary small" onClick={() => onAddBarcodeTo(likely)}>
              Add to {likely.name}
            </button>
          </div>
        </section>
      )}
      <AddPantryItem
        key={scanned.code}
        existing={items}
        fromBarcode={scanned}
        onAdded={onAdded}
        onUseExisting={onAddBarcodeTo}
        onScanAgain={canScan ? onScanAgain : undefined}
        onClose={onClose}
      />
      {items.length > 0 && (
        <form
          className="card stack scan-result"
          onSubmit={(event) => {
            event.preventDefault();
            const item = items.find((i) => i.id === otherId);
            if (item) onAddBarcodeTo(item);
          }}
        >
          <label>
            Already in the pantry under another name?
            <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
              <option value="">Pick it…</option>
              {[...items]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.location ? ` (${item.location})` : ""}
                  </option>
                ))}
            </select>
          </label>
          <button className="button" disabled={!otherId}>
            Add this barcode to it
          </button>
        </form>
      )}
    </>
  );
}

function PantryRow({
  item,
  onList,
  onEdit,
  onStatus,
  onOpened,
  onAddToList,
}: {
  item: PantryItem;
  onList: boolean;
  onEdit: () => void;
  onStatus: (status: PantryStatus) => void;
  onOpened: (opened: boolean) => void;
  onAddToList: () => void;
}) {
  // Only for things kept somewhere else once opened, while we have some.
  const openedPlace = (item.opened_location ?? "").trim();
  const canOpen = !!openedPlace && norm(openedPlace) !== norm(item.location) && item.status !== "out";
  return (
    <div className="pantry-row">
      <div className="pantry-main">
        <button className="pantry-name" onClick={onEdit} aria-label={`Edit ${item.name}`}>
          {item.name}
        </button>
        <div className="status-picker" role="group" aria-label={`How much ${item.name} we have`}>
          {STATUSES.map((status) => (
            <button
              key={status.value}
              className={`status-${status.value}`}
              aria-pressed={item.status === status.value}
              onClick={() => onStatus(status.value)}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>
      {item.note?.trim() && <span className="pantry-note">{item.note}</span>}
      {itemExpiry(item) && (
        <span className={`expiry expiry-${itemExpiry(item)}`}>{describeExpiry(item.expires)}</span>
      )}
      {(item.brand || item.store_url || canOpen) && (
        <span className="pantry-extra">
          {canOpen && (
            <button
              className="opened-toggle"
              aria-pressed={!!item.opened}
              onClick={() => onOpened(!item.opened)}
              title={item.opened ? `Tap to put it back in ${item.location || "Other"}, unopened` : undefined}
            >
              {item.opened ? "Opened" : `Opened → ${openedPlace}`}
            </button>
          )}
          {item.brand && <span className="pantry-brand">{item.brand}</span>}
          {item.store_url && <StoreLink url={item.store_url} itemName={item.name} />}
        </span>
      )}
      {item.status !== "have" &&
        (onList ? (
          <span className="on-list">
            <CartIcon size={14} />
            On the shopping list
          </span>
        ) : (
          <button className="link-button" onClick={onAddToList}>
            + Add to shopping list
          </button>
        ))}
    </div>
  );
}


const NEW_OPTION = "__new__";

// A dropdown of choices, with a last option to type a new one instead.
function CategorySelect({
  label,
  value,
  options,
  emptyLabel,
  newLabel,
  newPlaceholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  emptyLabel: string;
  newLabel: string;
  newPlaceholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [typingNew, setTypingNew] = useState(false);

  if (typingNew) {
    return (
      <label>
        {label}
        <span className="new-category">
          <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={newPlaceholder} />
          <button
            type="button"
            className="button ghost small"
            onClick={() => {
              setTypingNew(false);
              onChange("");
            }}
          >
            Cancel
          </button>
        </span>
      </label>
    );
  }

  // Match the saved value to its option regardless of capitals.
  const selected = options.find((option) => norm(option) === norm(value)) ?? "";
  return (
    <label>
      {label}
      <select
        value={selected}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === NEW_OPTION) {
            setTypingNew(true);
            onChange("");
          } else {
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={NEW_OPTION}>{newLabel}</option>
      </select>
    </label>
  );
}

// Name, place and subcategory. Subcategories only list ones belonging to the
// chosen place, and changing the place clears the subcategory.
function ItemFields({
  existing,
  fields,
  onChange,
  nameRef,
}: {
  existing: PantryItem[];
  fields: Fields;
  onChange: (patch: Partial<Fields>) => void;
  nameRef?: Ref<HTMLInputElement>;
}) {
  const places = placeOptions(existing);
  const subs = subcategoryOptions(existing, fields.location);
  // Keep a value that isn't in the lists yet (one just typed in) selectable.
  const withCurrent = (options: string[], value: string) =>
    value.trim() && !options.some((o) => norm(o) === norm(value)) ? [...options, value.trim()] : options;

  return (
    <>
      <label>
        Name
        <input
          ref={nameRef}
          value={fields.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Eggs"
          required
        />
      </label>
      <label>
        <span className="label-text">
          Note <span className="optional">(optional)</span>
        </span>
        <input
          value={fields.note}
          onChange={(e) => onChange({ note: e.target.value })}
          maxLength={200}
          placeholder="e.g. 3 cans"
        />
      </label>
      <label>
        <span className="label-text">
          Brands we buy <span className="optional">(optional)</span>
        </span>
        <input
          value={fields.brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          maxLength={120}
          placeholder="e.g. Coles, White Mill"
        />
      </label>
      <div className="row">
        <CategorySelect
          label="Where it lives"
          value={fields.location}
          options={withCurrent(places, fields.location)}
          emptyLabel="Not sorted"
          newLabel="+ New place…"
          newPlaceholder="New place, e.g. Pantry shelf"
          onChange={(location) => onChange({ location, subcategory: "" })}
        />
        <CategorySelect
          // A fresh dropdown for each place, so typing a new subcategory
          // under one place doesn't carry over to another.
          key={norm(fields.location)}
          label="Subcategory"
          value={fields.subcategory}
          options={withCurrent(subs, fields.subcategory)}
          emptyLabel={fields.location.trim() ? "None" : "Pick a place first"}
          newLabel="+ New subcategory…"
          newPlaceholder="New subcategory"
          disabled={!fields.location.trim()}
          onChange={(subcategory) => onChange({ subcategory })}
        />
      </div>
      <CategorySelect
        label="Once opened, keep in"
        value={fields.openedLocation}
        options={withCurrent(places, fields.openedLocation)}
        emptyLabel="The same place"
        newLabel="+ New place…"
        newPlaceholder="New place, e.g. Door shelf"
        onChange={(openedLocation) => onChange({ openedLocation })}
      />
      <label>
        <span className="label-text">
          Expires <span className="optional">(optional)</span>
        </span>
        <span className="date-row">
          <input type="date" value={fields.expires} onChange={(e) => onChange({ expires: e.target.value })} />
          {fields.expires && (
            <button type="button" className="button ghost small" onClick={() => onChange({ expires: "" })}>
              No date
            </button>
          )}
        </span>
      </label>
      <StoreLinkField
        // Store searches include the (first) brand: "Lea & Perrins Worcestershire".
        name={[brandsOf(fields.brand)[0] ?? "", fields.name].map((part) => part.trim()).filter(Boolean).join(" ")}
        value={fields.storeUrl}
        onChange={(storeUrl) => onChange({ storeUrl })}
      />
    </>
  );
}

// "Store link": the item's product page, like Coles' page for our exact
// Worcestershire sauce. In the Android app, "Find on Coles" opens Bento's
// browser on the store's search; open the product and tap "Link this item".
// In a web browser, the store opens in a new tab to copy the address from.
function StoreLinkField({ name, value, onChange }: { name: string; value: string; onChange: (url: string) => void }) {
  const [error, setError] = useState("");
  const stores = useStores();

  async function find(store: Store) {
    setError("");
    try {
      const picked = await pickPageLink(storeSearchUrl(store, name));
      if (picked) onChange(picked.url);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="store-link-field">
      <label>
        <span className="label-text">
          Store link <span className="optional">(optional)</span>
        </span>
        <span className="hint">
          {!stores.length
            ? "A shop's page for this product, copied from your browser."
            : hasBuiltInBrowser
              ? "Find it in a store, open the product, then tap Link this item."
              : "Search a store, open the product, then copy its address into here."}
        </span>
        {/* Plain text (with the web address keyboard), so "coles.com.au/…"
            without https:// isn't blocked by the browser; it's fixed up on save. */}
        <input
          inputMode="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={stores.length ? `https://www.${stores[0].host}/…` : "https://…"}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>
      <div className="store-buttons">
        {stores.map((store) =>
          hasBuiltInBrowser ? (
            <button
              key={store.name}
              type="button"
              className="button small"
              disabled={!name.trim()}
              onClick={() => void find(store)}
            >
              Find on <StoreLogo store={store} />
            </button>
          ) : (
            <a
              key={store.name}
              className={`button small ${name.trim() ? "" : "disabled"}`}
              href={name.trim() ? storeSearchUrl(store, name) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!name.trim()}
            >
              Search <StoreLogo store={store} /> ↗
            </a>
          )
        )}
        {value && (
          <button type="button" className="button ghost small" onClick={() => onChange("")}>
            No link
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// "Search stores": type something, get a search link for each store, like
// the Browse tab does for recipe sites. Results open in the phone's own
// browser (or a new tab), where you can shop. In the Android app, "Add from
// Coles" opens Bento's browser instead, with an "Add to pantry" button.
function StoreSearch({
  stores,
  onPicked,
}: {
  stores: Store[];
  onPicked: (picked: { url: string; name: string }) => void;
}) {
  const [text, setText] = useState("");
  const [searched, setSearched] = useState("");
  const [error, setError] = useState("");

  async function addFrom(store: Store) {
    setError("");
    try {
      const picked = await pickPageLink(storeSearchUrl(store, searched), "pantry");
      if (picked) onPicked(picked);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="card stack store-search">
      <form
        className="add-row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearched(text.trim());
        }}
      >
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. worcestershire sauce"
          aria-label="Search the stores"
          enterKeyHint="search"
          autoFocus
        />
        <button className="button primary small" disabled={!text.trim()}>
          Search
        </button>
      </form>
      {searched && (
        <ul className="site-list" aria-label={`Search “${searched}” on…`}>
          {stores.map((store) => (
            <li key={store.name}>
              <a className="site-row" href={storeSearchUrl(store, searched)} target="_blank" rel="noopener noreferrer">
                <span className="site-name store-result">
                  <StoreLogo store={store} size={28} />“{searched}”
                </span>
                <span className="site-go" aria-hidden="true">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {searched && hasBuiltInBrowser && (
        <div className="store-buttons">
          {stores.map((store) => (
            <button key={store.name} className="button small" onClick={() => void addFrom(store)}>
              Add from <StoreLogo store={store} />
            </button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <p className="muted small-note">
        {hasBuiltInBrowser
          ? "Add from a store to put a product in the pantry, linked to its page. To link something already in the pantry, tap its name and use Store link."
          : "To link something in the pantry to its product page, tap its name and use Store link. Or share a product page to Bentotachi from the phone."}
      </p>
    </section>
  );
}

// The starting name for an item from a store page: the page's product name
// (tidied), else words from its address.
function nameFromStore(picked: { url: string; name: string }): string {
  return productNameFromTitle(picked.name) || productNameFromUrl(picked.url);
}

// A typed store link made into a full address ("coles.com.au/…" gets
// https:// added); "" stays "". Returns null if it isn't a web address.
function cleanStoreUrl(text: string): string | null {
  return text.trim() ? normaliseSiteUrl(text) : "";
}

function AddPantryItem({
  existing,
  fromStore,
  fromBarcode,
  onAdded,
  onUseExisting,
  onScanAgain,
  onClose,
}: {
  existing: PantryItem[];
  // A store product page to start from, if any.
  fromStore?: { url: string; name: string } | null;
  // Or a scanned barcode, with what Open Food Facts says it is.
  fromBarcode?: Scanned;
  onAdded: (item: PantryItem) => void;
  // For a scanned barcode named like an item already in the pantry: put the
  // barcode (and brand) on that item instead.
  onUseExisting?: (item: PantryItem, brand: string) => void;
  onScanAgain?: () => void;
  onClose?: () => void;
}) {
  const product = fromBarcode?.product ?? null;
  const [fields, setFields] = useState<Fields>({
    name: fromStore ? nameFromStore(fromStore) : (product?.name ?? ""),
    location: "",
    subcategory: "",
    expires: "",
    storeUrl: fromStore?.url ?? "",
    brand: product?.brand ?? "",
    note: "",
    openedLocation: "",
  });
  // The item already in the pantry with the name typed, once Add finds it.
  const [duplicate, setDuplicate] = useState<PantryItem | null>(null);
  // The scanned barcode goes on the first item added (not ones after it).
  const [barcode, setBarcode] = useState(fromBarcode?.code ?? "");
  // Putting a store link into a new item suggests a name from it, and keeps
  // updating that suggestion (while the link is typed) until someone types
  // their own name.
  const suggested = useRef(fields.name);
  const change = (patch: Partial<Fields>) =>
    setFields((previous) => {
      const next = { ...previous, ...patch };
      if (patch.storeUrl !== undefined && (!previous.name.trim() || previous.name === suggested.current)) {
        next.name = productNameFromUrl(cleanStoreUrl(patch.storeUrl) ?? "");
        suggested.current = next.name;
      }
      return next;
    });
  // Bumped after each add so "new place" boxes turn back into dropdowns
  // (which now include the new name).
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // An item half filled in (the place chosen is kept between items, so that
  // alone doesn't count).
  useUnsavedChanges(
    !!(fields.name.trim() || fields.brand.trim() || fields.note.trim() || fields.expires || fields.storeUrl.trim())
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = fields.name.trim();
    const same = existing.find((i) => norm(i.name) === norm(name));
    setDuplicate(same ?? null);
    if (same) {
      setError(
        `“${same.name}” is already in the pantry${same.location ? ` (${same.location})` : ""}.` +
          (barcode && onUseExisting
            ? " If this is the same thing (another brand is fine), add it to that one. Or give this one a different name."
            : " Give this one a different name, or change that one."),
      );
      return;
    }
    const storeUrl = cleanStoreUrl(fields.storeUrl);
    if (storeUrl === null) {
      setError("The store link doesn't look like a web address. Copy it from the store's product page.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onAdded(
        await pantryItems().create({
          name,
          status: "have",
          location: fields.location.trim(),
          subcategory: fields.subcategory.trim(),
          expires: toStoredDate(fields.expires),
          store_url: storeUrl,
          brand: fields.brand.trim(),
          barcodes: barcode ? [barcode] : [],
          note: fields.note.trim(),
          opened_location: fields.openedLocation.trim(),
        })
      );
      setBarcode("");
      // Keep the places and subcategory chosen, so adding a whole shelf is
      // quick. Each item has its own expiry, store link, brand and note, so
      // those are cleared.
      setFields((previous) => ({ ...previous, name: "", expires: "", storeUrl: "", brand: "", note: "" }));
      setResetKey((key) => key + 1);
      nameRef.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      {fromStore && fields.storeUrl === fromStore.url && (
        <p className="muted small-note">
          From {storeName(fromStore.url)}. Shorten the name to what recipes call it, like “Worcestershire sauce”, so
          they find it.
        </p>
      )}
      {fromBarcode && barcode && (
        <p className="muted small-note">
          {product ? (
            <>
              Scanned: “{product.name}
              {product.quantity && `, ${product.quantity}`}” (from Open Food Facts). Shorten the name to what recipes call
              it, like “Basmati rice”, so they find it.
              {onScanAgain && (
                <>
                  {" "}
                  Not what you scanned?{" "}
                  <button type="button" className="link-button" onClick={onScanAgain}>
                    Scan again
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {fromBarcode.lookupError || "Open Food Facts doesn't know this barcode."} Type what it is, and Bentotachi will
              know it next time.
            </>
          )}
        </p>
      )}
      <ItemFields key={resetKey} existing={existing} fields={fields} nameRef={nameRef} onChange={change} />
      {error && <p className="error">{error}</p>}
      {error && duplicate && barcode && onUseExisting && (
        <div className="actions">
          <button type="button" className="button small" onClick={() => onUseExisting(duplicate, fields.brand)}>
            Add to {duplicate.name}
          </button>
        </div>
      )}
      <div className="actions">
        {onClose && (
          <button type="button" className="button ghost" onClick={onClose}>
            Done
          </button>
        )}
        <button className="button primary" disabled={busy || !fields.name.trim()}>
          {busy ? "Adding…" : "Add to pantry"}
        </button>
      </div>
    </form>
  );
}

function EditPantryItem({
  item,
  existing,
  onSaved,
  onCancel,
  onDelete,
}: {
  item: PantryItem;
  existing: PantryItem[];
  onSaved: (item: PantryItem) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [fields, setFields] = useState<Fields>({
    name: item.name,
    location: item.location,
    subcategory: item.subcategory,
    expires: expiryDate(item.expires),
    storeUrl: item.store_url ?? "",
    brand: item.brand ?? "",
    note: item.note ?? "",
    openedLocation: item.opened_location ?? "",
  });
  const [barcodes, setBarcodes] = useState(() => barcodesOf(item));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened] = useState(() => JSON.stringify([fields, barcodes]));
  useUnsavedChanges(JSON.stringify([fields, barcodes]) !== opened);

  async function scanAnother() {
    setError("");
    try {
      const code = normaliseBarcode((await scanBarcode()) ?? "");
      if (!code) return;
      const other = existing.find((i) => i.id !== item.id && barcodesOf(i).includes(code));
      if (other) setError(`That barcode is already on “${other.name}”.`);
      else setBarcodes(withBarcode({ barcodes }, code));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = fields.name.trim();
    const duplicate = existing.find((i) => i.id !== item.id && norm(i.name) === norm(name));
    if (duplicate) {
      setError(`“${duplicate.name}” is already in the pantry. Give this one a different name.`);
      return;
    }
    const storeUrl = cleanStoreUrl(fields.storeUrl);
    if (storeUrl === null) {
      setError("The store link doesn't look like a web address. Copy it from the store's product page.");
      return;
    }
    setBusy(true);
    setError("");
    const note = fields.note.trim();
    const openedLocation = fields.openedLocation.trim();
    try {
      const saved = await pantryItems().update(item.id, {
        name,
        location: fields.location.trim(),
        subcategory: fields.subcategory.trim(),
        expires: toStoredDate(fields.expires),
        store_url: storeUrl,
        brand: fields.brand.trim(),
        barcodes,
        note,
        opened_location: openedLocation,
        // Nowhere else to keep it once opened: it's just in its place.
        opened: openedLocation ? !!item.opened : false,
      });
      // A server not restarted since newer fields were added says "saved"
      // but quietly drops them.
      if (
        (storeUrl && saved.store_url !== storeUrl) ||
        (fields.brand.trim() && saved.brand !== fields.brand.trim()) ||
        (note && saved.note !== note)
      ) {
        setError("The server didn't keep everything. It needs restarting: close the Bentotachi server window and open Start Bentotachi.bat again.");
        setBusy(false);
        return;
      }
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="pantry-edit stack" onSubmit={submit}>
      <ItemFields
        existing={existing}
        fields={fields}
        onChange={(patch) => setFields((previous) => ({ ...previous, ...patch }))}
      />
      {(barcodes.length > 0 || canScan) && (
        <div className="barcode-list">
          <span className="label-text">Barcodes</span>
          {barcodes.map((code) => (
            <span key={code} className="barcode-chip">
              {code}
              <button
                type="button"
                className="chip-remove"
                aria-label={`Remove barcode ${code}`}
                onClick={() => setBarcodes(barcodes.filter((other) => other !== code))}
              >
                ✕
              </button>
            </span>
          ))}
          {canScan && (
            <button type="button" className="button small" onClick={() => void scanAnother()}>
              <span className="button-mark" aria-hidden="true">📷</span> Add one
            </button>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="button danger small push-left" onClick={onDelete}>
          Remove
        </button>
        <button type="button" className="button ghost small" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary small" disabled={busy || !fields.name.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

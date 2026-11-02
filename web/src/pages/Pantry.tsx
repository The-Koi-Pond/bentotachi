// The pantry page: a find-or-add box, filters, and a card per place (Simple
// or Detailed rows). The rows, forms and scanning screens are their own
// files (PantryRow, PantryForms, PantryScan); the sorting rules are in
// pantryGroups.ts.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import {
  errorMessage,
  pantryItems,
  pb,
  shoppingItems,
  type PantryItem,
  type PantryStatus,
  type ShoppingItem,
} from "../pb";
import DrawerToggle from "../DrawerToggle";
import { ChevronIcon } from "../icons";
import { forEveryone, useSingleUser } from "../household";
import { useLiveRecords } from "../useLiveRecords";
import { BenMood } from "../Brand";
import { itemWithBarcode, normaliseBarcode, withBarcode } from "../barcodes";
import { canScan, lookUpBarcode, scanBarcode, type BarcodeProduct } from "../scanner";
import { placeOf, withBrand } from "../pantryItem";
import { groupItems, matchesSearch, needsChecking, needsUsingSoon, norm } from "../pantryGroups";
import { useOnlinePhotos } from "../pantryPhoto";
import PantryRow, { type PantryLayout } from "../PantryRow";
import { ScanResult } from "../PantryScan";
import { AddPantryItem, EditPantryItem, type Scanned } from "../PantryForms";
import { confirmDiscard, hasUnsavedChanges } from "../unsavedChanges";

// The same empty list each time, so the photo filler doesn't re-run while
// the pantry is loading.
const NO_ITEMS: PantryItem[] = [];

type Filter = "all" | "low" | "out" | "soon";

// Simple or Detailed (see PantryRow), remembered for each person on this
// device; everyone starts in Simple, since Bentotachi never pushes
// stock-taking (docs/VISION.md).
const layoutKey = () => `bento.pantryLayout.${pb.authStore.record?.id ?? ""}`;
function savedLayout(): PantryLayout {
  try {
    return localStorage.getItem(layoutKey()) === "detailed" ? "detailed" : "simple";
  } catch {
    return "simple";
  }
}

export default function Pantry() {
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const singleUser = useSingleUser();
  const shopping = useLiveRecords<ShoppingItem>("shopping_items");
  const [layout, setLayout] = useState<PantryLayout>(savedLayout);
  const [filter, setFilter] = useState<Filter>("all");
  // What's typed in the find-or-add box: filters the pantry, and names the
  // new item if Add is tapped.
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  // The name the add form starts with (what was typed in the find box).
  const [startName, setStartName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Says where an item went when it moved drawers ("Opened", or running out).
  const [notice, setNotice] = useState("");
  // Something that just ran out: "Put it on the shopping list?" (setStatus).
  // Stays until answered, or until something else runs out.
  const [runOut, setRunOut] = useState<{ item: PantryItem; message: string } | null>(null);
  // Drawers start closed each visit; this holds the ones opened since.
  const [openDrawers, setOpenDrawers] = useState<Set<string>>(new Set());
  // A store product page to add as a new item, shared to Bento from another
  // app ("#/pantry?add=<link>").
  const [fromStore, setFromStore] = useState<{ url: string; name: string } | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [editingScanned, setEditingScanned] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedStoreLink = searchParams.get("add");
  // The top bar's + on this page ("#/pantry?new=1"): a new item.
  const plusTapped = searchParams.get("new");

  // Opening a different add form (or a scan) throws away the one on screen;
  // with unsaved changes in it, ask first. `replaces`: whether it would.
  const okToReplaceForm = (replaces: boolean) => !replaces || confirmDiscard(hasUnsavedChanges());
  // The add form is on screen (an empty pantry always shows it).
  const addFormOpen = adding || pantry.items?.length === 0;

  useEffect(() => {
    if (!sharedStoreLink && !plusTapped) return;
    // Out of the address, so going back doesn't open the form again.
    setSearchParams({}, { replace: true });
    // The + on a blank add form already open changes nothing.
    const replaces = !!scanned || (addFormOpen && (!!sharedStoreLink || !!fromStore || !!startName));
    if (!okToReplaceForm(replaces)) return;
    setFromStore(sharedStoreLink ? { url: sharedStoreLink, name: searchParams.get("name") ?? "" } : null);
    setStartName("");
    setScanned(null);
    setAdding(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedStoreLink, plusTapped]);

  function changeLayout(next: PantryLayout) {
    setLayout(next);
    try {
      localStorage.setItem(layoutKey(), next);
    } catch {
      // Not remembered; it'll start in Simple next time.
    }
  }

  // The notice goes away by itself after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const waiting = useMemo(() => (shopping.items ?? []).filter((item) => !item.checked), [shopping.items]);
  const items = pantry.items;
  // Photos found online (Open Food Facts, store links), for items that
  // don't have one yet.
  useOnlinePhotos(items ?? NO_ITEMS);

  const loadError = pantry.loadError || shopping.loadError;
  if (!items || !shopping.items) return loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading the pantry…</p>;

  // On the list if it's linked, or someone typed the same name by hand.
  const isOnList = (item: PantryItem) =>
    waiting.some((w) => w.pantry_item === item.id || (!w.pantry_item && norm(w.text) === norm(item.name)));

  // `also`: sent with the change but not kept (see setStatus). Whether it saved.
  async function save(item: PantryItem, patch: Partial<PantryItem>, movedTo: string, also = {}) {
    setError("");
    setNotice(movedTo);
    pantry.upsert({ ...item, ...patch });
    try {
      await pantryItems().update(item.id, { ...patch, ...also });
      return true;
    } catch (err) {
      pantry.upsert(item);
      setNotice("");
      setError(errorMessage(err));
      return false;
    }
  }

  // Something running out isn't put on the shopping list by itself: it may
  // not be wanted again for a while, so this asks (Xel, 2026-11-02). The
  // server would add it for apps from before this; ask_about_list tells it
  // this one asks (pantry.pb.js). An opened one that runs out goes back to
  // its own place, for the next unopened one.
  function setStatus(item: PantryItem, status: PantryStatus) {
    if (item.status === status) return;
    const runsOut = status === "out";
    const putBack = runsOut && item.opened;
    const place = item.location.trim();
    const moved =
      putBack && norm(placeOf(item).location) !== norm(place)
        ? `${item.name} is out, so it's back in ${place ? `the ${place}` : "Other"}, ready for the next one.`
        : "";
    const ask = runsOut && !isOnList(item);
    if (ask) setRunOut({ item, message: `${moved || `${item.name} is out.`} Put it on the shopping list?` });
    void save(item, putBack ? { status, opened: false } : { status }, ask ? "" : moved, runsOut ? { ask_about_list: true } : {}).then(
      // Didn't save: its question goes (not another item's asked since).
      (saved) => !saved && setRunOut((current) => (current?.item.id === item.id ? null : current)),
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
    // A scan replaces the add form, or the last scan's screen (even of the
    // same barcode: its form starts again).
    if (!okToReplaceForm(addFormOpen || !!scanned)) return;
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

  // The find-or-add box's Add (or Enter): a new item named what was typed.
  // A barcode number instead (typed, or a USB scanner's, which types it and
  // presses Enter) looks the barcode up, like scanning.
  function findOrAdd(event: FormEvent) {
    event.preventDefault();
    const typed = query.trim();
    if (/^[\d\s-]+$/.test(typed) && normaliseBarcode(typed)) {
      setQuery("");
      void takeBarcode(typed, true);
      return;
    }
    // The same name again keeps the form that's open.
    if (!okToReplaceForm(!!scanned || (addFormOpen && (!!fromStore || typed !== startName)))) return;
    setQuery("");
    setScanned(null);
    setFromStore(null);
    setStartName(typed);
    setAdding(true);
  }

  const ranOut = runOut && items.find((i) => i.id === runOut.item.id);
  const stillAsking = !!runOut && ranOut?.status === "out" && !isOnList(ranOut);

  const lowCount = items.filter((i) => i.status === "low").length;
  const outCount = items.filter((i) => i.status === "out").length;
  const soonCount = items.filter((i) => needsUsingSoon(i)).length;
  const shown = items.filter(
    (i) =>
      (filter === "all" ? true : filter === "soon" ? needsUsingSoon(i) : i.status === filter) && matchesSearch(i, query),
  );
  const groups = groupItems(shown);
  // A scanned barcode brings its own form (see ScanResult).
  const showForm = !scanned && (adding || items.length === 0);

  // A filter or a search shows its (short) results with every place open.
  const narrowed = filter !== "all" || !!query.trim();
  const isOpen = (key: string) => narrowed || openDrawers.has(key);
  const toggleDrawer = (key: string) =>
    setOpenDrawers((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allDrawerKeys = groups.map((g) => g.key);
  const allOpen = allDrawerKeys.length > 0 && allDrawerKeys.every((key) => openDrawers.has(key));

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
        <form className="add-row" role="search" onSubmit={findOrAdd}>
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
              onClick={() => setOpenDrawers(allOpen ? new Set() : new Set(allDrawerKeys))}
            >
              <ChevronIcon />
            </button>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {/* Gone by itself once it's no longer out, or someone puts it on the
          list meanwhile. */}
      {stillAsking ? (
        <p className="toast undo-toast" role="status">
          <span>{runOut.message}</span>
          <span className="toast-actions">
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
          </span>
        </p>
      ) : (
        notice && (
          <p className="toast" role="status">
            {notice}
          </p>
        )
      )}
      {items.length > 0 && shown.length === 0 && (
        <p className="muted">
          {query.trim()
            ? `Nothing called “${query.trim()}” in the pantry${filter === "all" ? "" : " with that filter"}. Tap Add to put it in.`
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
                    <li key={sub.key} className="pantry-sublabel">
                      {sub.label}
                    </li>
                  ),
                  ...sub.items.map((item) => (
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
                          layout={layout}
                          onList={isOnList(item)}
                          onEdit={() => setEditingId(item.id)}
                          onStatus={(status) => setStatus(item, status)}
                          onOpened={(opened) => setOpened(item, opened)}
                          onAddToList={() => addToList(item)}
                        />
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

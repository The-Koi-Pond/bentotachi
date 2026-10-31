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
import { useUnsavedChanges } from "../unsavedChanges";

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
  return uniqueLabels([...Object.keys(DEFAULT_PLACES), ...existing.map((i) => i.location)]);
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
  // The brand we like, or "".
  brand: string;
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
// "Other"; items with no subcategory go first within their place.
function groupItems(items: PantryItem[]): Group[] {
  const places = new Map<string, { label: string; subs: Map<string, { label: string; items: PantryItem[] }> }>();
  for (const item of items) {
    const placeKey = norm(item.location);
    if (!places.has(placeKey)) places.set(placeKey, { label: item.location.trim() || "Other", subs: new Map() });
    const subs = places.get(placeKey)!.subs;
    const subKey = norm(item.subcategory);
    if (!subs.has(subKey)) subs.set(subKey, { label: item.subcategory.trim(), items: [] });
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
  // Drawers start closed each visit; this holds the ones opened since.
  const [openDrawers, setOpenDrawers] = useState<Set<string>>(new Set());
  // A store product page to add as a new item: shared to Bento from another
  // app ("#/pantry?add=<link>"), or picked in Search stores.
  const [fromStore, setFromStore] = useState<{ url: string; name: string } | null>(null);
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

  const waiting = useMemo(() => (shopping.items ?? []).filter((item) => !item.checked), [shopping.items]);
  const items = pantry.items;

  const loadError = pantry.loadError || shopping.loadError;
  if (!items || !shopping.items) return loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading the pantry…</p>;

  // On the list if it's linked, or someone typed the same name by hand.
  const isOnList = (item: PantryItem) =>
    waiting.some((w) => w.pantry_item === item.id || (!w.pantry_item && norm(w.text) === norm(item.name)));

  async function setStatus(item: PantryItem, status: PantryStatus) {
    if (item.status === status) return;
    setError("");
    pantry.upsert({ ...item, status });
    try {
      // The server puts "out" items on the shopping list by itself.
      await pantryItems().update(item.id, { status });
    } catch (err) {
      pantry.upsert(item);
      setError(errorMessage(err));
    }
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

  async function remove(item: PantryItem) {
    if (!window.confirm(`Remove “${item.name}” from the pantry${forEveryone(singleUser)}?`)) return;
    setError("");
    try {
      await pantryItems().delete(item.id);
      pantry.removeLocally(item.id);
      setEditingId(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const lowCount = items.filter((i) => i.status === "low").length;
  const outCount = items.filter((i) => i.status === "out").length;
  const soonCount = items.filter(needsUsingSoon).length;
  const shown = items.filter((i) =>
    filter === "all" ? true : filter === "soon" ? needsUsingSoon(i) : i.status === filter
  );
  const groups = groupItems(shown);
  const showForm = adding || items.length === 0;

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
      <div className="section-head">
        <h1>Pantry</h1>
        <span className="title-actions">
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
        <p className="muted">
          Add the things you keep in stock. Group them by where they live, like “Fridge” or “Cupboard”, with optional
          subcategories like “Baking” or “Spices”.
        </p>
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

function PantryRow({
  item,
  onList,
  onEdit,
  onStatus,
  onAddToList,
}: {
  item: PantryItem;
  onList: boolean;
  onEdit: () => void;
  onStatus: (status: PantryStatus) => void;
  onAddToList: () => void;
}) {
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
      {itemExpiry(item) && (
        <span className={`expiry expiry-${itemExpiry(item)}`}>{describeExpiry(item.expires)}</span>
      )}
      {(item.brand || item.store_url) && (
        <span className="pantry-extra">
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
          Preferred brand <span className="optional">(optional)</span>
        </span>
        <input
          value={fields.brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          maxLength={60}
          placeholder="e.g. Lea & Perrins"
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
        // Store searches include the brand: "Lea & Perrins Worcestershire".
        name={[fields.brand, fields.name].map((part) => part.trim()).filter(Boolean).join(" ")}
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
          : "To link something in the pantry to its product page, tap its name and use Store link. Or share a product page to Bento from the phone."}
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
  onAdded,
  onClose,
}: {
  existing: PantryItem[];
  // A store product page to start from, if any.
  fromStore?: { url: string; name: string } | null;
  onAdded: (item: PantryItem) => void;
  onClose?: () => void;
}) {
  const [fields, setFields] = useState<Fields>({
    name: fromStore ? nameFromStore(fromStore) : "",
    location: "",
    subcategory: "",
    expires: "",
    storeUrl: fromStore?.url ?? "",
    brand: "",
  });
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
  useUnsavedChanges(!!(fields.name.trim() || fields.brand.trim() || fields.expires || fields.storeUrl.trim()));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = fields.name.trim();
    const duplicate = existing.find((i) => norm(i.name) === norm(name));
    if (duplicate) {
      setError(`“${duplicate.name}” is already in the pantry${duplicate.location ? ` (${duplicate.location})` : ""}.`);
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
        })
      );
      // Keep the place and subcategory chosen, so adding a whole shelf is
      // quick. Each item has its own expiry, store link and brand, so those are cleared.
      setFields((previous) => ({ ...previous, name: "", expires: "", storeUrl: "", brand: "" }));
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
      <ItemFields key={resetKey} existing={existing} fields={fields} nameRef={nameRef} onChange={change} />
      {error && <p className="error">{error}</p>}
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
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened] = useState(() => JSON.stringify(fields));
  useUnsavedChanges(JSON.stringify(fields) !== opened);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = fields.name.trim();
    const duplicate = existing.find((i) => i.id !== item.id && norm(i.name) === norm(name));
    if (duplicate) {
      setError(`“${duplicate.name}” is already in the pantry.`);
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
      const saved = await pantryItems().update(item.id, {
        name,
        location: fields.location.trim(),
        subcategory: fields.subcategory.trim(),
        expires: toStoredDate(fields.expires),
        store_url: storeUrl,
        brand: fields.brand.trim(),
      });
      // A server not restarted since store links and brands were added says
      // "saved" but quietly drops them.
      if ((storeUrl && saved.store_url !== storeUrl) || (fields.brand.trim() && saved.brand !== fields.brand.trim())) {
        setError("The server didn't keep everything. It needs restarting: close the Bento server window and open Start Bento.bat again.");
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

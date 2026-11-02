// How the pantry page sorts and labels items: drawers by place and
// subcategory, the places offered in the dropdowns, and what needs using up.
// Kept out of the page so the tests can load it (web/test/pantryGroups.test.ts).
import type { PantryItem } from "./pb";
import { daysUntil, expiryState, type ExpiryState } from "./expiry.ts";
import { placeOf } from "./pantryItem.ts";

export const norm = (text: string) => text.trim().toLowerCase();

type Dated = Pick<PantryItem, "status" | "expires">;

// Expiry only matters for things we still have; once it's out, it's gone.
// (`now` is for the tests; the app always means today.)
export function itemExpiry(item: Dated, now = new Date()): ExpiryState | null {
  if (item.status === "out") return null;
  const days = daysUntil(item.expires, now);
  return days === null ? null : expiryState(days);
}

export const needsUsingSoon = (item: Dated, now = new Date()) => {
  const state = itemExpiry(item, now);
  return state === "expired" || state === "soon";
};

// Worth a look: running low, run out, or to use up soon. Counted as "3 to
// check" on a place's heading; the filters say which.
export const needsChecking = (item: Dated, now = new Date()) => item.status !== "have" || needsUsingSoon(item, now);

// Whether an item matches what's typed in the pantry's find box: in its
// name or its brands, ignoring capitals. Nothing typed matches everything.
export function matchesSearch(item: Pick<PantryItem, "name" | "brand">, typed: string): boolean {
  const words = norm(typed).split(/\s+/).filter(Boolean);
  const text = norm(`${item.name} ${item.brand ?? ""}`);
  return words.every((word) => text.includes(word));
}

// Starter places and their subcategories, always offered in the dropdowns.
// Places and subcategories people add themselves come from the items that
// use them, so a subcategory made under "Fridge" is only offered there.
const DEFAULT_PLACES: Record<string, string[]> = {
  Fridge: ["Dairy", "Meat & fish", "Fruit & veg", "Sauces & condiments", "Drinks"],
  Freezer: ["Meat & fish", "Vegetables", "Ready meals", "Desserts"],
  Cupboard: ["Baking", "Spices", "Grains & pasta", "Tins & jars", "Oils & vinegars", "Snacks"],
};

type Placed = Pick<PantryItem, "location" | "subcategory" | "opened_location">;

export function placeOptions(existing: Placed[]): string[] {
  return uniqueLabels([
    ...Object.keys(DEFAULT_PLACES),
    ...existing.flatMap((i) => [i.location, i.opened_location ?? ""]),
  ]);
}

export function subcategoryOptions(existing: Placed[], place: string): string[] {
  if (!place.trim()) return [];
  const defaults = Object.entries(DEFAULT_PLACES).find(([name]) => norm(name) === norm(place))?.[1] ?? [];
  return uniqueLabels([
    ...defaults,
    ...existing.filter((i) => norm(i.location) === norm(place)).map((i) => i.subcategory),
  ]);
}

// `key` identifies a drawer for opening/closing: the place, or place/subcategory.
export interface Subgroup<T> {
  key: string;
  label: string;
  items: T[];
}

export interface Group<T> {
  key: string;
  label: string;
  subgroups: Subgroup<T>[];
}

type Groupable = Pick<PantryItem, "name" | "location" | "subcategory" | "opened_location" | "opened">;

// Place -> subcategory -> items. Spelling differences in case ("fridge" vs
// "Fridge") land in the same group. Items with no place go last under
// "Other"; items with no subcategory go first within their place. Opened
// items go in their once-opened place (see placeOf).
export function groupItems<T extends Groupable>(items: T[]): Group<T>[] {
  const places = new Map<string, { label: string; subs: Map<string, { label: string; items: T[] }> }>();
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

// Removes blanks and case-only duplicates (the first spelling wins, so the
// starter names keep their capitals), then sorts A to Z.
export function uniqueLabels(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) if (value.trim() && !seen.has(norm(value))) seen.set(norm(value), value.trim());
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

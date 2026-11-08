// A pantry item's form fields (Add and Edit share them): filling them from an
// item, and turning them back into what's saved. Kept out of the forms so the
// tests can load it (web/test/pantryFields.test.ts).
import type { PantryItem } from "./pb";
import { expiryDate, toStoredDate } from "./expiry.ts";
import { cleanStoreLinks, storeLinkFields, storeLinksOf } from "./pantryItem.ts";
import { norm } from "./pantryGroups.ts";
import { barcodesOf } from "./barcodes.ts";
import { changedFields } from "./changedFields.ts";

export interface Fields {
  name: string;
  location: string;
  subcategory: string;
  // "2026-11-02" or "" (the date input's format).
  expires: string;
  // Its product pages in stores, as typed or picked, one per box (at least
  // one box, maybe empty).
  storeUrls: string[];
  // The favourite brand ("White Mill"), or "". Older items may list several
  // ("Coles, White Mill"; see brandsToPickFrom in pantryPackets.ts).
  brand: string;
  // "3 cans", or "".
  note: string;
  // Where it goes once opened, or "" for nowhere else.
  openedLocation: string;
}

type Saved = Pick<
  PantryItem,
  "name" | "location" | "subcategory" | "expires" | "store_url" | "more_store_urls" | "brand" | "note" | "opened_location"
>;

// What the fields save, shared by adding and editing (each adds its own
// extras, like the status or barcodes).
export type ItemRecord = Saved & { more_store_urls: string[] };

export const STORE_LINK_TYPO = "A store link doesn't look like a web address. Copy it from the store's product page.";

// The fields for an item being edited, or blank ones for a new item.
export function fieldsOf(item?: Partial<Saved>): Fields {
  const links = item ? storeLinksOf(item) : [];
  return {
    name: item?.name ?? "",
    location: item?.location ?? "",
    subcategory: item?.subcategory ?? "",
    expires: expiryDate(item?.expires ?? ""),
    storeUrls: links.length ? links : [""],
    brand: item?.brand ?? "",
    note: item?.note ?? "",
    openedLocation: item?.opened_location ?? "",
  };
}

// The fields as saved, tidied (spaces trimmed, store links made into full
// addresses). null if a store link isn't a web address (see STORE_LINK_TYPO).
export function recordFrom(fields: Fields): ItemRecord | null {
  const links = cleanStoreLinks(fields.storeUrls);
  if (links === null) return null;
  return {
    name: fields.name.trim(),
    location: fields.location.trim(),
    subcategory: fields.subcategory.trim(),
    expires: toStoredDate(fields.expires),
    ...storeLinkFields(links),
    brand: fields.brand.trim(),
    note: fields.note.trim(),
    opened_location: fields.openedLocation.trim(),
  };
}

// What saving the Edit form sends: only what was changed in it, compared
// with the item as the form opened, so a housemate's change made meanwhile
// (a new expiry, a scanned barcode) isn't put back.
export function editChanges(
  start: Partial<Saved> & Pick<PantryItem, "barcodes" | "opened">,
  record: ItemRecord,
  barcodes: string[]
): Record<string, unknown> {
  const before = recordFrom(fieldsOf(start)) ?? {};
  return changedFields(
    // Nowhere else to keep it once opened: it's just in its place.
    { ...record, barcodes, opened: record.opened_location ? !!start.opened : false },
    { ...before, barcodes: barcodesOf(start), opened: !!start.opened }
  );
}

// Another item already called this (ignoring capitals and spaces), if any.
// `exceptId`: the item being edited, which may keep its own name.
export function sameName<T extends { id: string; name: string }>(existing: T[], name: string, exceptId?: string) {
  return existing.find((other) => other.id !== exceptId && norm(other.name) === norm(name));
}

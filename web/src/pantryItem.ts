// Where a pantry item shows, and its brands (see the pantry_opened_notes
// migration).
import { barcodesOf } from "./barcodes.ts";
import { normaliseSiteUrl } from "./recipeSites.ts";
import { storeFor } from "./stores.ts";

interface Placed {
  location: string;
  subcategory: string;
  opened_location?: string;
  opened?: boolean;
}

// Opened, and it has an "once opened" place: it's there now, straight inside
// that place (its subcategory belongs to its own place). Otherwise its own
// place.
export function placeOf(item: Placed): { location: string; subcategory: string } {
  const openedPlace = (item.opened_location ?? "").trim();
  if (item.opened && openedPlace && openedPlace.toLowerCase() !== item.location.trim().toLowerCase())
    return { location: openedPlace, subcategory: "" };
  return { location: item.location, subcategory: item.subcategory };
}

// "Coles, White Mill" -> ["Coles", "White Mill"]: the brand field of items
// from before favourite brands, which listed every brand bought.
export function brandsOf(text: string | undefined): string[] {
  return (text ?? "")
    .split(",")
    .map((brand) => brand.trim())
    .filter(Boolean);
}

// The brand to show beside an item's name, or "" when it would only repeat
// the name: a scanned product whose brand is its name ("Nutella").
export function brandBesideName(item: { name: string; brand?: string }): string {
  const brand = (item.brand ?? "").trim();
  return brand.toLowerCase() === item.name.trim().toLowerCase() ? "" : brand;
}

interface StoreLinked {
  store_url?: string;
  more_store_urls?: unknown;
}

// The most store links an item keeps.
export const MOST_STORE_LINKS = 5;

// An item's store links, first one first (see the pantry_more_store_links
// migration): store_url, then more_store_urls. Only full web addresses
// (they're opened when tapped), without repeats, at most 5.
export function storeLinksOf(item: StoreLinked): string[] {
  const more = Array.isArray(item.more_store_urls) ? item.more_store_urls : [];
  const links: string[] = [];
  for (const link of [item.store_url, ...more]) {
    const text = typeof link === "string" ? link.trim() : "";
    if (/^https?:\/\/\S+$/i.test(text) && !links.includes(text)) links.push(text);
  }
  return links.slice(0, MOST_STORE_LINKS);
}

// The store links typed into an item's form, made into full addresses
// ("coles.com.au/…" gets https://), without blanks or repeats, at most 5.
// null if one of them isn't a web address.
export function cleanStoreLinks(typed: string[]): string[] | null {
  const links: string[] = [];
  for (const text of typed) {
    if (!text.trim()) continue;
    const link = normaliseSiteUrl(text);
    if (!link) return null;
    if (!links.includes(link)) links.push(link);
  }
  return links.slice(0, MOST_STORE_LINKS);
}

// The form's link boxes with a link just picked in a store (Find on Coles):
// it replaces a link to the same store (a better page for the same thing),
// else fills the first empty box, else goes at the end (or, with 5 already,
// replaces the last).
export function withPickedLink(boxes: string[], picked: string): string[] {
  const store = storeFor(picked);
  const sameStore = store ? boxes.findIndex((box) => storeFor(normaliseSiteUrl(box) ?? "")?.name === store.name) : -1;
  const empty = boxes.findIndex((box) => !box.trim());
  const at = sameStore >= 0 ? sameStore : empty >= 0 ? empty : Math.min(boxes.length, MOST_STORE_LINKS - 1);
  const next = [...boxes];
  next[at] = picked;
  return next;
}

// Store links as they're saved: the first in store_url, the rest in
// more_store_urls.
export function storeLinkFields(links: string[]): { store_url: string; more_store_urls: string[] } {
  return { store_url: links[0] ?? "", more_store_urls: links.slice(1, MOST_STORE_LINKS) };
}

// Where the app looks for an item's photo online (pantryPhoto.ts): its
// barcodes (Open Food Facts) and its store links, as one piece of text, kept
// in photo_link_tried once they've been tried. For an item with one link and
// no barcodes that's just its link, as it was before barcodes were asked.
// Cut to the 2,000 characters photo_link_tried holds.
export function photoSources(item: { barcodes?: unknown } & StoreLinked): string {
  return [...barcodesOf(item), ...storeLinksOf(item)].join(" ").slice(0, 2000);
}

// What photo_link_tried holds once someone removes an item's photo: it's
// never looked up by itself again (on any phone, whatever barcodes or links
// it gets later), only when someone taps "Find its photo online".
export const PHOTO_REMOVED = "removed";

// Whether the app should look for an item's photo online by itself
// (pantryPhoto.ts): it has a barcode or a store link and no photo, nobody
// removed its photo (PHOTO_REMOVED), and its barcodes and links haven't been
// tried yet. Tried stays tried whether a photo came or none was found; a new
// barcode or link gets them tried again.
export function wantsOnlinePhoto(
  item: {
    barcodes?: unknown;
    photo?: string;
    photo_link_tried?: string;
  } & StoreLinked
): boolean {
  const sources = photoSources(item);
  const tried = item.photo_link_tried ?? "";
  return !!sources && !item.photo && tried !== PHOTO_REMOVED && tried !== sources;
}

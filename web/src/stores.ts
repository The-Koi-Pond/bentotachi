// Grocery stores for finding pantry items online, by country (the
// household's country is chosen on the Household page; see country.ts).
// `search` is the store's own search page, with {q} where the search words go.
//
// Australia, checked 2026-10-30: both search links answered normally. ALDI
// didn't answer automated checks at all, so it isn't here yet.
// United States, checked 2026-10-31 in a real browser: Target's search showed
// products; Kroger's search page opened (products need a nearby store picked,
// which a test browser in Australia can't); Walmart asks automated browsers
// "Robot or human?", so it was checked only by its standard addresses.

export type CountryCode = "AU" | "US";

export interface Store {
  name: string;
  country: CountryCode;
  // The address every page of the store is under, for naming product links.
  host: string;
  search: string;
}

export const STORES: Store[] = [
  { name: "Coles", country: "AU", host: "coles.com.au", search: "https://www.coles.com.au/search/products?q={q}" },
  {
    name: "Woolworths",
    country: "AU",
    host: "woolworths.com.au",
    search: "https://www.woolworths.com.au/shop/search/products?searchTerm={q}",
  },
  { name: "Walmart", country: "US", host: "walmart.com", search: "https://www.walmart.com/search?q={q}" },
  { name: "Target", country: "US", host: "target.com", search: "https://www.target.com/s?searchTerm={q}" },
  { name: "Kroger", country: "US", host: "kroger.com", search: "https://www.kroger.com/search?query={q}" },
];

// The stores to offer in a country (none for countries Bento doesn't know
// stores in yet).
export function storesIn(country: string): Store[] {
  return STORES.filter((store) => store.country === country);
}

export function storeSearchUrl(store: Store, words: string): string {
  return store.search.replace("{q}", encodeURIComponent(words.trim()));
}

// The store a link belongs to, if it's one of the stores above (from any
// country, so a link someone saved still shows its store).
export function storeFor(url: string): Store | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return STORES.find((store) => host === store.host || host.endsWith(`.${store.host}`));
  } catch {
    return undefined;
  }
}

// "Coles" for a Coles product page; otherwise the site's address, like
// "iga.com.au".
export function storeName(url: string): string {
  const store = storeFor(url);
  if (store) return store.name;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Store";
  }
}

// Whether a link is a page in one of the stores above.
export function isStoreLink(url: string): boolean {
  return storeFor(url) !== undefined;
}

// Pack sizes at the end of a product name: "250mL", "1.5kg", "12 pack",
// "6 x 375ml", "10 fl oz", "1 gal", "16 ct".
const PACK_SIZE =
  /(\s*[|,-]?\s*(\d+\s*x\s*)?\d+(\.\d+)?\s*(ml|l|g|kg|pk|pack|each|ea|fl\.?\s*oz|oz|lbs?|gal|ct|count)\b\.?)+$/i;

function tidyName(name: string): string {
  const words = name.replace(PACK_SIZE, "").replace(/\s+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

// A starting name for a pantry item from a store's product page address:
// ".../product/lea-perrins-worcestershire-sauce-250ml-1234567" -> "Lea perrins worcestershire sauce".
export function productNameFromUrl(url: string): string {
  let parts: string[];
  try {
    parts = new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return "";
  }
  // The last part with letters in it (Woolworths and Walmart put a number
  // after it, Target "-/A-12345678").
  const slug = [...parts].reverse().find((part) => /[a-z]/i.test(part) && !/^A-\d+$/.test(part)) ?? "";
  if (/^(product|productdetails|shop|search|ip|p)$/i.test(slug)) return "";
  const words = decodeURIComponent(slug)
    .replace(/\.html?$/i, "")
    .replace(/[-_]\d{4,}$/, "")
    // Target spells symbols as their HTML numbers: "rao-39-s" is "rao's",
    // "salt-38-pepper" is "salt & pepper", "-8482" is ™.
    .replace(/-39-/g, "'")
    .replace(/-38-/g, " & ")
    .replace(/-(8482|174|169)\b/g, "")
    .replace(/[-_+]+/g, " ");
  return tidyName(words.toLowerCase());
}

// A starting name from a product page's title:
// "Buy Lea & Perrins Worcestershire Sauce | 250mL | Coles" -> "Lea & Perrins Worcestershire Sauce";
// "Lea & Perrins Worcestershire Sauce, 10 fl oz - Walmart.com" -> "Lea & Perrins Worcestershire Sauce".
export function productNameFromTitle(title: string): string {
  const storeNames = STORES.map((store) => store.name.toLowerCase());
  const parts = title
    .split(/\s+[|–—:-]\s+|\s*\|\s*/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        !storeNames.includes(part.toLowerCase().replace(/\.com$/, "")) &&
        !/^(online|shop)$/i.test(part),
    );
  return tidyName((parts[0] ?? "").replace(/^buy\s+/i, "").replace(/,\s*$/, ""));
}

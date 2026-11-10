// The products a pantry item's household buys ("Nutella 400 g", its barcodes
// and store links; docs/VISION.md, "Products we buy"), as the app shows and
// changes them. The server remembers new ones by itself and keeps the
// item's barcodes and store links from them (server/pb_hooks/
// pantry_products.js). Tested in web/test/pantryProducts.test.ts.
import type { PantryItem, PantryProduct } from "./pb";
import type { PacketDetails } from "./pantryPackets.ts";
import { norm } from "./pantryGroups.ts";
import { cleanStoreLinks, MOST_STORE_LINKS } from "./pantryItem.ts";

type Producted = Pick<PantryItem, "products" | "usual_packet">;

export function productsOf(item: Pick<PantryItem, "products">): PantryProduct[] {
  return Array.isArray(item.products) ? item.products : [];
}

export const sameKind = (a: PacketDetails, b: PacketDetails) => norm(a.brand) === norm(b.brand) && norm(a.size) === norm(b.size);

// "Nutella 400 g"; one known only by its barcode is "Not named yet".
export function productName(product: Pick<PantryProduct, "brand" | "size">): string {
  return [product.brand, product.size].map((part) => part.trim()).filter(Boolean).join(" ") || "Not named yet";
}

// Under a product's name: its barcode ("2 barcodes" when there are more)
// and which stores it has links for.
export function productNote(product: PantryProduct, storeName: (link: string) => string): string {
  const codes = product.barcodes.length === 1 ? `Barcode ${product.barcodes[0]}` : product.barcodes.length > 1 ? `${product.barcodes.length} barcodes` : "";
  const stores = [...new Set(product.links.map(storeName))];
  const links = stores.length ? `${stores.join(", ")} link` : "";
  return [codes, links].filter(Boolean).join(" · ") || "No barcode yet";
}

// The favourite (what "+ 1 more" and the shopping list add), if it's one of
// the products.
export function preferredProduct(item: Producted): PantryProduct | null {
  const usual = usualOf(item);
  return usual ? (productsOf(item).find((p) => sameKind(p, usual)) ?? null) : null;
}

// The named products besides the favourite, for one-tap adding.
export function otherProducts(item: Producted): PantryProduct[] {
  const preferred = preferredProduct(item);
  return productsOf(item).filter((p) => p !== preferred && (p.brand.trim() || p.size.trim()));
}

// The product a barcode is on, if any.
export function productWithBarcode(item: Pick<PantryItem, "products">, code: string): PantryProduct | null {
  return productsOf(item).find((p) => p.barcodes.includes(code)) ?? null;
}

// A product added by hand or by scanning: joins one of the same brand and
// size (its barcode added), else goes at the end.
export function addProduct(products: PantryProduct[], added: PacketDetails & { barcode?: string }): PantryProduct[] {
  const code = added.barcode ?? "";
  const at = products.findIndex((p) => sameKind(p, added));
  if (at >= 0) {
    return products.map((p, i) => (i === at && code && !p.barcodes.includes(code) ? { ...p, barcodes: [...p.barcodes, code] } : p));
  }
  return [...products, { brand: added.brand.trim(), size: added.size.trim(), barcodes: code ? [code] : [], links: [] }];
}

// The products as they're saved: brand and size trimmed, store links made
// into full addresses (cleanStoreLinks), empty ones dropped. null if a
// store link isn't a web address.
export function cleanProducts(products: PantryProduct[]): PantryProduct[] | null {
  const cleaned: PantryProduct[] = [];
  for (const product of products) {
    const links = cleanStoreLinks(product.links);
    if (links === null) return null;
    const tidy = { brand: product.brand.trim(), size: product.size.trim(), barcodes: product.barcodes, links };
    if (tidy.brand || tidy.size || tidy.barcodes.length || tidy.links.length) cleaned.push(tidy);
  }
  return cleaned;
}

// Every barcode and store link on the products, the favourite's first, as
// the server keeps them on the item (for looking up its photo).
export function productSources(products: PantryProduct[], preferred: PacketDetails | null): { barcodes: string[]; links: string[] } {
  const first = preferred ? products.find((p) => sameKind(p, preferred)) : undefined;
  const ordered = first ? [first, ...products.filter((p) => p !== first)] : products;
  return {
    barcodes: [...new Set(ordered.flatMap((p) => p.barcodes))],
    links: [...new Set(ordered.flatMap((p) => p.links))].slice(0, MOST_STORE_LINKS),
  };
}

// The item's favourite as plain details, or null.
export function usualOf(item: Pick<PantryItem, "usual_packet">): PacketDetails | null {
  const usual = item.usual_packet;
  return usual && (usual.brand || usual.size) ? { brand: usual.brand ?? "", size: usual.size ?? "" } : null;
}

// The edit form's products as it saves them, with what reached the server
// while the form was open (`start` is the list it opened with, `live` the
// item's now): a product remembered from a label just added, a barcode or
// link another phone put on one. The server takes a sent list as the whole
// truth, so the form's own copy would take those off again. One the form
// renamed keeps what reached it (found by a barcode or link it had); one it
// removed stays removed.
export function withServerAdditions(edited: PantryProduct[], start: PantryProduct[], live: PantryProduct[]): PantryProduct[] {
  let next = edited;
  for (const now of live) {
    const before = start.find((p) => sameKind(p, now));
    const has = (pick: (p: PantryProduct) => string[], value: string) => next.some((p) => pick(p).includes(value));
    const barcodes = now.barcodes.filter((code) => !before?.barcodes.includes(code) && !has((p) => p.barcodes, code));
    const links = now.links.filter((link) => !before?.links.includes(link) && !has((p) => p.links, link));
    const same = next.findIndex((p) => sameKind(p, now));
    const renamed = before && same < 0 ? next.findIndex((p) => before.barcodes.some((c) => p.barcodes.includes(c)) || before.links.some((l) => p.links.includes(l))) : -1;
    const at = same >= 0 ? same : renamed;
    if (at >= 0) {
      if (!barcodes.length && !links.length) continue;
      next = next.map((p, i) =>
        i === at ? { ...p, barcodes: [...p.barcodes, ...barcodes], links: [...p.links, ...links].slice(0, MOST_STORE_LINKS) } : p
      );
    } else if (!before && (now.brand.trim() || now.size.trim() || barcodes.length || links.length)) {
      next = [...next, { ...now, barcodes, links }];
    }
  }
  return next;
}

// The products with the one at `index` changed (or taken out, with null).
export function replaceProduct(products: PantryProduct[], index: number, product: PantryProduct | null): PantryProduct[] {
  return product ? products.map((p, i) => (i === index ? product : p)) : products.filter((_, i) => i !== index);
}

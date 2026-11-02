// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  brandsOf,
  cleanStoreLinks,
  MOST_STORE_LINKS,
  PHOTO_REMOVED,
  photoSources,
  placeOf,
  storeLinkFields,
  storeLinksOf,
  wantsOnlinePhoto,
  withBrand,
  withPickedLink,
} from "../src/pantryItem.ts";

const LINK = "https://www.coles.com.au/product/heinz-ketchup-tomato-sauce-500ml-5328995";
const CODE = "9300633603161";

test("an item with a store link and no photo gets looked up", () => {
  assert.equal(wantsOnlinePhoto({ store_url: LINK, photo: "" }), true);
  // From before photos existed: no photo_link_tried at all.
  assert.equal(wantsOnlinePhoto({ store_url: LINK }), true);
});

test("so does one with only a barcode", () => {
  assert.equal(wantsOnlinePhoto({ barcodes: [CODE], store_url: "", photo: "" }), true);
});

test("an item without a barcode or store link, or with a photo, doesn't", () => {
  assert.equal(wantsOnlinePhoto({ store_url: "", photo: "" }), false);
  assert.equal(wantsOnlinePhoto({ barcodes: [], store_url: "  ", photo: "" }), false);
  assert.equal(wantsOnlinePhoto({ barcodes: [CODE], store_url: LINK, photo: "photo_abc.jpg" }), false);
});

test("what was tried isn't tried again", () => {
  const item = { barcodes: [CODE], store_url: LINK, photo: "" };
  assert.equal(wantsOnlinePhoto({ ...item, photo_link_tried: photoSources(item) }), false);
});

test("a removed photo stays removed, even after another barcode or link", () => {
  const removed = { barcodes: [CODE], store_url: LINK, photo: "", photo_link_tried: PHOTO_REMOVED };
  assert.equal(wantsOnlinePhoto(removed), false);
  assert.equal(wantsOnlinePhoto({ ...removed, barcodes: [CODE, "9310000000001"] }), false);
  assert.equal(wantsOnlinePhoto({ ...removed, more_store_urls: ["https://www.woolworths.com.au/shop/productdetails/1"] }), false);
});

test("an item without barcodes is remembered by its link, as before barcodes were asked", () => {
  assert.equal(photoSources({ store_url: ` ${LINK} ` }), LINK);
  assert.equal(wantsOnlinePhoto({ store_url: LINK, photo: "", photo_link_tried: LINK }), false);
});

test("a new link or barcode is tried, even after the old ones were", () => {
  const other = "https://www.woolworths.com.au/shop/productdetails/36059";
  assert.equal(wantsOnlinePhoto({ store_url: other, photo: "", photo_link_tried: LINK }), true);
  // A link tried before Open Food Facts was asked: its barcode gets a go.
  assert.equal(wantsOnlinePhoto({ barcodes: [CODE], store_url: LINK, photo: "", photo_link_tried: LINK }), true);
});

test("every store link counts, so adding one tries again", () => {
  const woolies = "https://www.woolworths.com.au/shop/productdetails/36059";
  assert.equal(photoSources({ barcodes: [CODE], store_url: LINK, more_store_urls: [woolies] }), `${CODE} ${LINK} ${woolies}`);
  assert.equal(wantsOnlinePhoto({ store_url: LINK, more_store_urls: [woolies], photo: "", photo_link_tried: LINK }), true);
});

test("store links: the first, then the rest, full addresses only, no repeats, at most 5", () => {
  const woolies = "https://www.woolworths.com.au/shop/productdetails/36059";
  assert.deepEqual(storeLinksOf({ store_url: LINK, more_store_urls: [woolies] }), [LINK, woolies]);
  // From before there were more: no more_store_urls at all, or null.
  assert.deepEqual(storeLinksOf({ store_url: LINK }), [LINK]);
  assert.deepEqual(storeLinksOf({ store_url: LINK, more_store_urls: null }), [LINK]);
  // An older app removed the first link but left the others.
  assert.deepEqual(storeLinksOf({ store_url: "", more_store_urls: [woolies] }), [woolies]);
  assert.deepEqual(storeLinksOf({ store_url: LINK, more_store_urls: [LINK, " ", 7, "javascript:alert(1)", "coles jam"] }), [LINK]);
  const many = Array.from({ length: 7 }, (_, i) => `https://shop.example.com/${i}`);
  assert.equal(storeLinksOf({ store_url: "", more_store_urls: many }).length, MOST_STORE_LINKS);
});

test("store links are saved as the first and the rest", () => {
  const woolies = "https://www.woolworths.com.au/shop/productdetails/36059";
  assert.deepEqual(storeLinkFields([LINK, woolies]), { store_url: LINK, more_store_urls: [woolies] });
  assert.deepEqual(storeLinkFields([]), { store_url: "", more_store_urls: [] });
});

test("typed store links become full addresses, without blanks or repeats", () => {
  assert.deepEqual(cleanStoreLinks(["coles.com.au/product/x-1", "", "  ", "https://coles.com.au/product/x-1"]), [
    "https://coles.com.au/product/x-1",
  ]);
  assert.deepEqual(cleanStoreLinks(["", ""]), []);
  assert.equal(cleanStoreLinks([LINK, "coles jam"]), null);
});

test("a link picked in a store replaces that store's link, else fills a gap, else goes last", () => {
  const woolies = "https://www.woolworths.com.au/shop/productdetails/36059";
  const otherColes = "https://www.coles.com.au/product/heinz-ketchup-1kg-999";
  assert.deepEqual(withPickedLink([LINK, ""], otherColes), [otherColes, ""]);
  assert.deepEqual(withPickedLink([LINK, ""], woolies), [LINK, woolies]);
  assert.deepEqual(withPickedLink([LINK], woolies), [LINK, woolies]);
  assert.deepEqual(withPickedLink([""], LINK), [LINK]);
  // Typed without https:// still counts as Coles.
  assert.deepEqual(withPickedLink(["coles.com.au/product/x-1", woolies], LINK), [LINK, woolies]);
  const full = Array.from({ length: MOST_STORE_LINKS }, (_, i) => `https://shop.example.com/${i}`);
  assert.deepEqual(withPickedLink(full, LINK), [...full.slice(0, -1), LINK]);
});

test("what was tried fits in photo_link_tried", () => {
  const long = `https://www.example.com/${"a".repeat(2100)}`;
  assert.equal(photoSources({ barcodes: [CODE], store_url: long }).length, 2000);
});

test("an opened item shows in its once-opened place", () => {
  const sauce = { location: "Cupboard", subcategory: "Tins & jars", opened_location: "Fridge", opened: false };
  assert.deepEqual(placeOf(sauce), { location: "Cupboard", subcategory: "Tins & jars" });
  assert.deepEqual(placeOf({ ...sauce, opened: true }), { location: "Fridge", subcategory: "" });
});

test("opened without a once-opened place (or the same place) stays put", () => {
  assert.deepEqual(placeOf({ location: "Cupboard", subcategory: "Baking", opened: true }), {
    location: "Cupboard",
    subcategory: "Baking",
  });
  assert.deepEqual(placeOf({ location: "Fridge", subcategory: "Dairy", opened_location: "fridge ", opened: true }), {
    location: "Fridge",
    subcategory: "Dairy",
  });
});

test("brands are a comma list without repeats", () => {
  assert.deepEqual(brandsOf("Coles, White Mill ,"), ["Coles", "White Mill"]);
  assert.deepEqual(brandsOf(""), []);
  assert.equal(withBrand("Coles", "White Mill"), "Coles, White Mill");
  assert.equal(withBrand("Coles, White Mill", "white mill"), "Coles, White Mill");
  assert.equal(withBrand("", "Coles"), "Coles");
  assert.equal(withBrand("Coles", " "), "Coles");
});

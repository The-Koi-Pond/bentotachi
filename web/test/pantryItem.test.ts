// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { brandsOf, placeOf, wantsLinkPhoto, withBrand } from "../src/pantryItem.ts";

const LINK = "https://www.coles.com.au/product/heinz-ketchup-tomato-sauce-500ml-5328995";

test("an item with a store link and no photo gets the link's photo", () => {
  assert.equal(wantsLinkPhoto({ store_url: LINK, photo: "" }), true);
  // From before photos existed: no photo_link_tried at all.
  assert.equal(wantsLinkPhoto({ store_url: LINK }), true);
});

test("an item without a store link, or with a photo, doesn't", () => {
  assert.equal(wantsLinkPhoto({ store_url: "", photo: "" }), false);
  assert.equal(wantsLinkPhoto({ store_url: "  ", photo: "" }), false);
  assert.equal(wantsLinkPhoto({ store_url: LINK, photo: "photo_abc.jpg" }), false);
});

test("a link already tried isn't tried again, so a removed photo stays removed", () => {
  assert.equal(wantsLinkPhoto({ store_url: LINK, photo: "", photo_link_tried: LINK }), false);
});

test("a new link is tried, even after an old one was", () => {
  const other = "https://www.woolworths.com.au/shop/productdetails/36059";
  assert.equal(wantsLinkPhoto({ store_url: other, photo: "", photo_link_tried: LINK }), true);
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

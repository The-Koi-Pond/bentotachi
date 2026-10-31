// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { brandsOf, placeOf, withBrand } from "../src/pantryItem.ts";

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

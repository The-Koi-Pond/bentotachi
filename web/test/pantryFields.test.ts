// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { editChanges, fieldsOf, recordFrom, sameName } from "../src/pantryFields.ts";

const COLES = "https://www.coles.com.au/product/lea-perrins-worcestershire-sauce-250ml-123";
const WOOLIES = "https://www.woolworths.com.au/shop/productdetails/36059";

test("a new item's form starts blank, with one empty store link box", () => {
  assert.deepEqual(fieldsOf(), {
    name: "",
    location: "",
    subcategory: "",
    expires: "",
    storeUrls: [""],
    brand: "",
    note: "",
    kindOf: "",
  });
});

test("an item's form holds what it has saved, and saves it back unchanged", () => {
  const saved = {
    name: "Worcestershire sauce",
    location: "Cupboard",
    subcategory: "Sauces",
    expires: "2027-03-01 00:00:00.000Z",
    store_url: COLES,
    more_store_urls: [WOOLIES],
    brand: "Lea & Perrins",
    note: "Big bottle",
    kind_of: "Sauce",
  };
  const fields = fieldsOf(saved);
  assert.equal(fields.expires, "2027-03-01");
  assert.deepEqual(fields.storeUrls, [COLES, WOOLIES]);
  assert.deepEqual(recordFrom(fields), saved);
});

test("saving tidies what was typed", () => {
  const record = recordFrom({
    ...fieldsOf(),
    name: "  Eggs ",
    location: " Fridge",
    storeUrls: ["", "coles.com.au/product/eggs-1", " "],
    brand: " Sunny ",
  });
  assert.equal(record?.name, "Eggs");
  assert.equal(record?.location, "Fridge");
  assert.equal(record?.brand, "Sunny");
  assert.equal(record?.store_url, "https://coles.com.au/product/eggs-1");
  assert.deepEqual(record?.more_store_urls, []);
  assert.equal(record?.expires, "");
});

test("a store link that isn't a web address stops the save", () => {
  assert.equal(recordFrom({ ...fieldsOf(), name: "Eggs", storeUrls: ["coles eggs"] }), null);
});

test("names already in the pantry are found, ignoring capitals, except the item being edited", () => {
  const existing = [
    { id: "a", name: "Eggs" },
    { id: "b", name: "Plain flour" },
  ];
  assert.equal(sameName(existing, " eggs ")?.id, "a");
  assert.equal(sameName(existing, "Eggs", "a"), undefined);
  assert.equal(sameName(existing, "Rice"), undefined);
});

const milk = {
  name: "Milk",
  location: "Fridge",
  subcategory: "Dairy",
  expires: "2026-11-20 00:00:00.000Z",
  store_url: COLES,
  more_store_urls: [],
  brand: "",
  note: "",
  barcodes: ["9300633603161"],
};

test("an edit sends only what was changed in the form, so a housemate's change meanwhile stays", () => {
  const record = recordFrom({ ...fieldsOf(milk), note: "2 L" })!;
  assert.deepEqual(editChanges(milk, record, milk.barcodes), { note: "2 L" });
});

test("an edit with nothing changed sends nothing", () => {
  assert.deepEqual(editChanges(milk, recordFrom(fieldsOf(milk))!, ["9300633603161"]), {});
});

test("an edit sends a barcode added in the form", () => {
  const codes = ["9300633603161", "9310036000017"];
  assert.deepEqual(editChanges(milk, recordFrom(fieldsOf(milk))!, codes), { barcodes: codes });
});

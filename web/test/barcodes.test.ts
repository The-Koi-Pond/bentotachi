// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { barcodesOf, itemWithBarcode, normaliseBarcode, withBarcode } from "../src/barcodes.ts";

test("barcodes are kept as digits, with UPC-A as its 13-digit EAN", () => {
  assert.equal(normaliseBarcode("9300633603161"), "9300633603161");
  assert.equal(normaliseBarcode(" 9300 633-603161 "), "9300633603161");
  assert.equal(normaliseBarcode("012345678905"), "0012345678905");
  assert.equal(normaliseBarcode("96385074"), "96385074");
  assert.equal(normaliseBarcode("1234"), "");
  assert.equal(normaliseBarcode("hello"), "");
});

test("finds the item a barcode belongs to", () => {
  const items = [
    { name: "Rice", barcodes: ["9300633603161", "9310000000001"] },
    { name: "Milk", barcodes: null },
    { name: "Oats", barcodes: "broken" },
  ];
  assert.equal(itemWithBarcode(items, "9310000000001")?.name, "Rice");
  assert.equal(itemWithBarcode(items, "0000000000000"), undefined);
  assert.deepEqual(barcodesOf(items[2]), []);
});

test("adding a barcode doesn't repeat one", () => {
  assert.deepEqual(withBarcode({ barcodes: ["1"] }, "2"), ["1", "2"]);
  assert.deepEqual(withBarcode({ barcodes: ["1"] }, "1"), ["1"]);
  assert.deepEqual(withBarcode({}, "3"), ["3"]);
});

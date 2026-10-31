// Run from the project folder with: node --test "server/test/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const { isBarcode, productFromOpenFoodFacts } = require("../pb_hooks/barcode_lookup.js");

test("barcodes are 8 to 14 digits", () => {
  assert.equal(isBarcode("9300633603161"), true);
  assert.equal(isBarcode("12345678"), true);
  assert.equal(isBarcode("1234567"), false);
  assert.equal(isBarcode("93006336abc"), false);
  assert.equal(isBarcode("../../etc"), false);
});

test("reads a product's name, brand and size, preferring English", () => {
  const answer = {
    status: 1,
    product: { product_name: "Riz basmati", product_name_en: " Basmati  Rice ", brands: "Coles, Coles Australia", quantity: "1 kg" },
  };
  assert.deepEqual(productFromOpenFoodFacts(answer), { name: "Basmati Rice", brand: "Coles", quantity: "1 kg" });
  assert.deepEqual(productFromOpenFoodFacts({ status: 1, product: { generic_name: "Soy sauce" } }), {
    name: "Soy sauce",
    brand: "",
    quantity: "",
  });
});

test("unknown or nameless products are not found", () => {
  assert.equal(productFromOpenFoodFacts({ status: 0, status_verbose: "product not found" }), null);
  assert.equal(productFromOpenFoodFacts({ status: 1, product: { brands: "Coles" } }), null);
  assert.equal(productFromOpenFoodFacts(null), null);
});

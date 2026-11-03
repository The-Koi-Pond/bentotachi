// Run from the project folder with: node --test "server/test/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const { isBarcode, productFromOpenFoodFacts, photoFromOpenFoodFacts } = require("../pb_hooks/barcode_lookup.js");

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

test("drops Europe's ℮ mark from the size, but not a word's last e", () => {
  const size = (quantity) => productFromOpenFoodFacts({ status: 1, product: { product_name: "X", quantity } }).quantity;
  assert.equal(size("400 g e"), "400 g"); // Nutella, as Open Food Facts has it (2026-11-03)
  assert.equal(size("750 ml ℮"), "750 ml");
  assert.equal(size("500g℮"), "500g");
  assert.equal(size("1 litre"), "1 litre");
  assert.equal(size("1 Litre"), "1 Litre");
});

test("unknown or nameless products are not found", () => {
  assert.equal(productFromOpenFoodFacts({ status: 0, status_verbose: "product not found" }), null);
  assert.equal(productFromOpenFoodFacts({ status: 1, product: { brands: "Coles" } }), null);
  assert.equal(productFromOpenFoodFacts(null), null);
});

test("finds a product's front photo, the bigger one first", () => {
  const small = "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.200.jpg";
  const big = "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.400.jpg";
  assert.equal(photoFromOpenFoodFacts({ status: 1, product: { image_front_small_url: small, image_front_url: big } }), big);
  assert.equal(photoFromOpenFoodFacts({ status: 1, product: { image_front_small_url: small } }), small);
});

test("no photo when it has none, or doesn't know the product", () => {
  assert.equal(photoFromOpenFoodFacts({ status: 1, product: {} }), "");
  assert.equal(photoFromOpenFoodFacts({ status: 1, product: { image_front_url: "javascript:alert(1)" } }), "");
  assert.equal(photoFromOpenFoodFacts({ status: 0, status_verbose: "product not found" }), "");
  assert.equal(photoFromOpenFoodFacts(null), "");
});

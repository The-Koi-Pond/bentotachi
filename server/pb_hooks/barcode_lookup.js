// What a barcode is, from Open Food Facts (a free, open database of food
// products: https://world.openfoodfacts.org). Used by barcodes.pb.js; kept
// separate so it can be tested (server/test/barcode_lookup.test.js).

// Open Food Facts asks apps to say who they are.
const USER_AGENT = "Bentotachi/1.9 (household pantry app; https://github.com/The-Koi-Pond/bento)";

// Barcodes are 8 to 14 digits (EAN-8, UPC-A, EAN-13, GTIN-14).
function isBarcode(code) {
  return /^\d{8,14}$/.test(String(code));
}

function lookupUrl(code) {
  return `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,generic_name,generic_name_en,brands,quantity`;
}

// Open Food Facts' answer -> { name, brand, quantity }, or null if it doesn't
// know the product (or knows it without a name).
function productFromOpenFoodFacts(answer) {
  if (!answer || answer.status !== 1 || !answer.product) return null;
  const p = answer.product;
  const clean = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
  const name = clean(p.product_name_en) || clean(p.product_name) || clean(p.generic_name_en) || clean(p.generic_name);
  if (!name) return null;
  // "Coles, Coles Australia" -> "Coles"
  const brand = clean(String(p.brands ?? "").split(",")[0]);
  return { name, brand, quantity: clean(p.quantity) };
}

module.exports = { USER_AGENT, isBarcode, lookupUrl, productFromOpenFoodFacts };

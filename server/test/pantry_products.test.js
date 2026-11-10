// Run from the project folder with: node --test "server/test/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseProducts, withProduct, foldIn, newSince, deriveFields, withoutRemoved } = require("../pb_hooks/pantry_products.js");

const NUT = "3017620422003";
const BIG = "3017620425035";
const COLES = "https://www.coles.com.au/product/nutella-400g";
const WOOLIES = "https://www.woolworths.com.au/shop/productdetails/1/nutella";

test("a brand and size already there joins it; a new one is added", () => {
  let products = withProduct([], { brand: "Nutella", size: "400 g", barcode: NUT });
  products = withProduct(products, { brand: "nutella ", size: "400 G", link: COLES });
  products = withProduct(products, { brand: "Nutella", size: "750 g", barcode: BIG });
  assert.deepEqual(products, [
    { brand: "Nutella", size: "400 g", barcodes: [NUT], links: [COLES] },
    { brand: "Nutella", size: "750 g", barcodes: [BIG], links: [] },
  ]);
});

test("an unnamed barcode is a product of its own until named, then moves", () => {
  let products = withProduct([], { barcode: NUT });
  assert.deepEqual(products, [{ brand: "", size: "", barcodes: [NUT], links: [] }]);
  products = withProduct(products, { brand: "Nutella", size: "400 g", barcode: NUT });
  assert.deepEqual(products, [{ brand: "Nutella", size: "400 g", barcodes: [NUT], links: [] }], "the empty one goes");
});

test("a barcode on one named product isn't taken by another", () => {
  let products = withProduct([], { brand: "Nutella", size: "400 g", barcode: NUT });
  products = withProduct(products, { brand: "Nutella", size: "750 g", barcode: NUT });
  assert.deepEqual(products[0].barcodes, [NUT]);
  assert.deepEqual(products[1].barcodes, []);
});

test("nothing to remember adds nothing", () => {
  assert.deepEqual(withProduct([], {}), []);
  assert.deepEqual(withProduct([], { brand: " ", size: "" }), []);
});

test("an item from before products: barcodes, links, favourite and brand fold in", () => {
  const item = {
    brand: "Nutella",
    usual_packet: { brand: "Nutella", size: "400 g" },
    barcodes: [NUT, BIG, "9300633603161"],
    barcode_details: { [NUT]: { brand: "Nutella", size: "400 g" }, [BIG]: { brand: "Nutella", size: "750 g" } },
    store_url: COLES,
    more_store_urls: [WOOLIES],
  };
  // The undescribed one of several barcodes: could be any of them, so unnamed.
  assert.deepEqual(foldIn([], item), [
    { brand: "Nutella", size: "400 g", barcodes: [NUT], links: [COLES, WOOLIES] },
    { brand: "Nutella", size: "750 g", barcodes: [BIG], links: [] },
    { brand: "", size: "", barcodes: ["9300633603161"], links: [] },
  ]);
});

test("folding in what's already there changes nothing", () => {
  const products = [{ brand: "Nutella", size: "400 g", barcodes: [NUT], links: [COLES] }];
  const item = { brand: "Nutella", usual_packet: { brand: "Nutella", size: "400 g" }, barcodes: [NUT], store_url: COLES };
  assert.deepEqual(foldIn(products, item), products);
});

test("an older item's list of brands becomes a product each", () => {
  const products = foldIn([], { brand: "Coles, White Mill", barcodes: [] });
  assert.deepEqual(products.map((p) => p.brand), ["Coles", "White Mill"]);
});

test("a brand with a sized product from a barcode isn't added again on its own", () => {
  const products = foldIn([], { brand: "Barilla", barcodes: [NUT], barcode_details: { [NUT]: { brand: "Barilla", size: "500 g" } } });
  assert.deepEqual(products, [{ brand: "Barilla", size: "500 g", barcodes: [NUT], links: [] }]);
});

test("an item's only barcode, undescribed, goes with the only brand it knows: the brand, not a size", () => {
  assert.deepEqual(foldIn([], { brand: "Heinz", barcodes: [NUT] }), [{ brand: "Heinz", size: "", barcodes: [NUT], links: [] }]);
  // The favourite may be another size than the one scanned.
  assert.deepEqual(foldIn([], { brand: "Heinz", usual_packet: { brand: "Heinz", size: "500 g" }, barcodes: [NUT] }), [
    { brand: "Heinz", size: "500 g", barcodes: [], links: [] },
    { brand: "Heinz", size: "", barcodes: [NUT], links: [] },
  ]);
  const unnamed = (fields) => foldIn([], fields).some((p) => !p.brand && !p.size && p.barcodes.includes(NUT));
  assert.ok(unnamed({ brand: "Heinz", usual_packet: { brand: "Edgell", size: "" }, barcodes: [NUT] }), "two brands: either");
  assert.ok(unnamed({ brand: "Heinz", barcodes: [NUT], label_brands: ["Edgell"] }), "a stand-in in stock: either");
  assert.ok(unnamed({ brand: "Heinz", barcodes: [NUT, BIG] }), "several barcodes: any");
});

test("a barcode on a brand with no size moves to that brand's sized product, once a scan says the size", () => {
  const before = [{ brand: "Heinz", size: "", barcodes: [NUT], links: [] }];
  assert.deepEqual(withProduct(before, { brand: "Heinz", size: "500 ml", barcode: NUT }), [{ brand: "Heinz", size: "500 ml", barcodes: [NUT], links: [] }]);
  // One with a link of its own stays.
  const linked = [{ brand: "Heinz", size: "", barcodes: [NUT], links: [COLES] }];
  assert.deepEqual(withProduct(linked, { brand: "Heinz", size: "500 ml", barcode: NUT }), [
    { brand: "Heinz", size: "", barcodes: [], links: [COLES] },
    { brand: "Heinz", size: "500 ml", barcodes: [NUT], links: [] },
  ]);
  // Another brand's sized one doesn't take it.
  assert.deepEqual(withProduct(before, { brand: "Edgell", size: "420 g", barcode: NUT }), [before[0], { brand: "Edgell", size: "420 g", barcodes: [], links: [] }]);
});

test("a save without products folds in only what it changed", () => {
  const before = {
    brand: "Uncle Tobys, Coles",
    usual_packet: JSON.stringify({ brand: "Coles", size: "1 kg" }),
    barcodes: JSON.stringify([NUT]),
    barcode_details: JSON.stringify({ [NUT]: { brand: "Masterfods", size: "500 ml" } }),
    store_url: COLES,
    more_store_urls: "[]",
  };
  // A status tap: nothing of these changed, so nothing comes back.
  const kept = [{ brand: "Masterfoods", size: "500 ml", barcodes: [NUT], links: [] }];
  assert.deepEqual(foldIn(kept, newSince(before, before), before), kept);
  // An older app adds a brand, a described barcode and a link: just those.
  const after = {
    ...before,
    brand: "Uncle Tobys, Coles, Keens",
    barcodes: JSON.stringify([NUT, BIG]),
    barcode_details: JSON.stringify({ [NUT]: { brand: "Masterfods", size: "500 ml" }, [BIG]: { brand: "Keens", size: "50 g" } }),
    more_store_urls: JSON.stringify([WOOLIES]),
  };
  assert.deepEqual(foldIn(kept, newSince(before, after), after), [
    { brand: "Masterfoods", size: "500 ml", barcodes: [NUT], links: [WOOLIES] },
    { brand: "Keens", size: "50 g", barcodes: [BIG], links: [] },
  ]);
});

test("a favourite an older app picks is folded in", () => {
  const before = { brand: "Coles", usual_packet: "null" };
  const after = { brand: "Coles", usual_packet: JSON.stringify({ brand: "Coles", size: "2 kg" }) };
  assert.deepEqual(foldIn([], newSince(before, after), after), [{ brand: "Coles", size: "2 kg", barcodes: [], links: [] }]);
});

test("a link with no product to go on is a product of its own", () => {
  assert.deepEqual(foldIn([], { store_url: COLES }), [{ brand: "", size: "", barcodes: [], links: [COLES] }]);
});

test("the old fields kept from products: every barcode, the favourite's links first", () => {
  const products = [
    { brand: "Bon Maman", size: "360 g", barcodes: ["111111111111"], links: [WOOLIES] },
    { brand: "Nutella", size: "400 g", barcodes: [NUT], links: [COLES] },
  ];
  assert.deepEqual(deriveFields(products, { brand: "Nutella", size: "400 g" }), {
    barcodes: [NUT, "111111111111"],
    store_url: COLES,
    more_store_urls: [WOOLIES],
  });
  assert.deepEqual(deriveFields([], null), { barcodes: [], store_url: "", more_store_urls: [] });
});

test("what an older app took off the item's barcodes or links goes from products too", () => {
  const products = [
    { brand: "Nutella", size: "400 g", barcodes: [NUT, BIG], links: [COLES, WOOLIES] },
    { brand: "", size: "", barcodes: ["9300633603161"], links: [] },
  ];
  const before = { barcodes: [NUT, BIG, "9300633603161"], store_url: COLES, more_store_urls: [WOOLIES] };
  const after = { barcodes: [NUT], store_url: COLES, more_store_urls: [] };
  assert.deepEqual(withoutRemoved(products, before, after), [{ brand: "Nutella", size: "400 g", barcodes: [NUT], links: [COLES] }]);
});

test("stored products are read whatever shape they come in", () => {
  assert.deepEqual(parseProducts(JSON.stringify([{ brand: " Nutella ", size: "400 g", barcodes: [NUT, "x"], links: ["nope", COLES] }])), [
    { brand: "Nutella", size: "400 g", barcodes: [NUT], links: [COLES] },
  ]);
  assert.deepEqual(parseProducts("not json"), []);
  assert.deepEqual(parseProducts(null), []);
});

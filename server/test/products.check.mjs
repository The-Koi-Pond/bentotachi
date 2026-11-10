// Checks pantry products (pantry_products.js and .pb.js) against a throwaway
// PocketBase on :8091 (set it up as pantry-rules.check.mjs says). Never
// point this at the real server: it creates test accounts and pantry items.
//   node test/products.check.mjs
// Every line should say PASS.
const B = `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api`;
async function api(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

const admin = (await api("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
const run = Date.now();
const username = `pr${run}`;
await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: username });
const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });
const itemNow = (id) => api(token, "GET", `/collections/pantry_items/records/${id}`);
const NUT = "3017620422003";
const BIG = "3017620425035";
const OTHER = "9300633603161";
const MUSTARD = "9310000000012";
const COLES = "https://www.coles.com.au/product/nutella-400g";
const WOOLIES = "https://www.woolworths.com.au/shop/productdetails/1/nutella";

// This app sends products; the old fields follow them.
const spread = await api(token, "POST", "/collections/pantry_items/records", {
  name: `Spread ${run}`,
  status: "have",
  brand: "Nutella",
  usual_packet: { brand: "Nutella", size: "400 g" },
  products: [
    { brand: "Bon Maman", size: "360 g", barcodes: [], links: [WOOLIES] },
    { brand: "Nutella", size: "400 g", barcodes: [NUT], links: [COLES] },
  ],
});
check(
  "an item's barcodes and store links follow its products, the favourite's first",
  JSON.stringify(spread.barcodes) === JSON.stringify([NUT]) && spread.store_url === COLES && JSON.stringify(spread.more_store_urls) === JSON.stringify([WOOLIES]),
  JSON.stringify([spread.barcodes, spread.store_url, spread.more_store_urls])
);

// A new brand and size in stock becomes a product; a new barcode on a known
// one joins it; a use-by date marks the item as dated.
await api(token, "POST", "/collections/pantry_packets/records", { item: spread.id, brand: "Nutella", size: "750 g", barcode: BIG });
await api(token, "POST", "/collections/pantry_packets/records", { item: spread.id, brand: "Nutella", size: "400 g", barcode: OTHER, expires: "2026-12-14 00:00:00.000Z" });
const grown = await itemNow(spread.id);
const big = grown.products.find((p) => p.size === "750 g");
const usual = grown.products.find((p) => p.size === "400 g");
check("a new brand and size in stock is remembered as a product", !!big && big.barcodes.includes(BIG), JSON.stringify(grown.products));
check("...a second barcode for a known one joins it", usual?.barcodes.includes(OTHER) && grown.barcodes.includes(OTHER), JSON.stringify(usual));
check("...and a use-by date means the household dates this item", grown.dates_used === true);

// This app takes a barcode off a product: the item's barcodes follow.
const trimmed = grown.products.map((p) => (p.size === "400 g" ? { ...p, barcodes: [NUT] } : p));
const afterTrim = await api(token, "PATCH", `/collections/pantry_items/records/${spread.id}`, { products: trimmed });
check("a barcode taken off a product goes from the item too", !afterTrim.barcodes.includes(OTHER) && afterTrim.barcodes.includes(NUT), JSON.stringify(afterTrim.barcodes));

// An older app sends barcodes and links, not products.
const sauce = await api(token, "POST", "/collections/pantry_items/records", { name: `Sauce ${run}`, status: "have", brand: "Masterfoods", barcodes: [OTHER], store_url: COLES });
check(
  "an older app's new item gets products from its barcodes and links",
  sauce.products.some((p) => p.barcodes.includes(OTHER)) && sauce.products.some((p) => p.brand === "Masterfoods" && p.links.includes(COLES)),
  JSON.stringify(sauce.products)
);
const added = await api(token, "PATCH", `/collections/pantry_items/records/${sauce.id}`, {
  barcodes: [OTHER, BIG],
  barcode_details: { [BIG]: { brand: "Masterfoods", size: "500 ml" } },
});
check("...a barcode an older app adds joins the products, as what it says it is", added.products.some((p) => p.size === "500 ml" && p.barcodes.includes(BIG)), JSON.stringify(added.products));
const removed = await api(token, "PATCH", `/collections/pantry_items/records/${sauce.id}`, { barcodes: [BIG], store_url: "" });
check(
  "...and one it takes off (or a link) leaves them, and doesn't come back",
  !removed.products.some((p) => p.barcodes.includes(OTHER) || p.links.includes(COLES)) && JSON.stringify(removed.barcodes) === JSON.stringify([BIG]) && removed.store_url === "",
  JSON.stringify([removed.products, removed.barcodes, removed.store_url])
);
let refused = false;
try {
  await api(token, "PATCH", `/collections/pantry_items/records/${sauce.id}`, { store_url: "coles sauce" });
} catch {
  refused = true;
}
check("...a store link that isn't a web address is still refused, not quietly dropped", refused);
const untouched = await api(token, "PATCH", `/collections/pantry_items/records/${sauce.id}`, { status: "low" });
check("saving something else leaves products alone", JSON.stringify(untouched.products) === JSON.stringify(removed.products), JSON.stringify(untouched.products));

// What the older fields still say (a scan's barcode_details, a list of
// brands, the favourite) doesn't bring back a product this app renamed or
// removed, at the next save without products (a Have/Low/Out tap).
const typo = await api(token, "POST", "/collections/pantry_items/records", {
  name: `Mustard ${run}`,
  status: "have",
  brand: "Uncle Tobys, Coles",
  usual_packet: { brand: "Coles", size: "1 kg" },
  barcodes: [MUSTARD],
  barcode_details: { [MUSTARD]: { brand: "Masterfods", size: "500 ml" } },
});
await api(token, "PATCH", `/collections/pantry_items/records/${typo.id}`, {
  products: [
    { brand: "Masterfoods", size: "500 ml", barcodes: [MUSTARD], links: [] },
    { brand: "Uncle Tobys", size: "", barcodes: [], links: [] },
  ],
  usual_packet: null,
});
const tapped = await api(token, "PATCH", `/collections/pantry_items/records/${typo.id}`, { status: "low" });
check(
  "a product renamed or removed (the favourite, one of a list of brands) doesn't come back at the next tap",
  JSON.stringify(tapped.products.map((p) => `${p.brand}|${p.size}`)) === JSON.stringify(["Masterfoods|500 ml", "Uncle Tobys|"]),
  JSON.stringify(tapped.products)
);
// A label's size corrected: its barcode moves to the corrected product.
const RICE = "9310000000029";
const rice = await api(token, "POST", "/collections/pantry_items/records", { name: `Rice ${run}`, status: "have", brand: "SunRice" });
const bag = await api(token, "POST", "/collections/pantry_packets/records", { item: rice.id, brand: "SunRice", size: "5 kg", barcode: RICE });
await api(token, "PATCH", `/collections/pantry_packets/records/${bag.id}`, { size: "1 kg" });
const riceNow = await itemNow(rice.id);
const holds = (size) => riceNow.products.find((p) => p.size === size)?.barcodes.includes(RICE);
check("a label's size corrected moves its barcode to the corrected product", holds("1 kg") === true && !holds("5 kg"), JSON.stringify(riceNow.products));

const newBrand = await api(token, "PATCH", `/collections/pantry_items/records/${typo.id}`, { brand: "Uncle Tobys, Coles, Keens" });
check(
  "...while a brand an older app adds to the list still joins them",
  newBrand.products.some((p) => p.brand === "Keens") && !newBrand.products.some((p) => p.brand === "Coles"),
  JSON.stringify(newBrand.products)
);

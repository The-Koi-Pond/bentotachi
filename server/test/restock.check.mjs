// Checks that ticking something bought on the shopping list adds a packet
// like the item's usual one, and unticking takes it back off (pantry.pb.js,
// the pantry_usual_packet migration), against a throwaway PocketBase on
// :8091 (set it up as pantry-rules.check.mjs says). Never point this at the
// real server: it creates test accounts, pantry items and packets.
//   node test/restock.check.mjs
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
const username = `rs${run}`;
await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: username });
const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });

const item = (name, status = "have") => api(token, "POST", "/collections/pantry_items/records", { name: `${name} ${run}`, status });
const getItem = (id) => api(token, "GET", `/collections/pantry_items/records/${id}`);
const packetsOf = async (itemId) =>
  (await api(token, "GET", `/collections/pantry_packets/records?filter=${encodeURIComponent(`item = "${itemId}"`)}`)).items;
const onList = (pantryItem, text) =>
  api(token, "POST", "/collections/shopping_items/records", { text, checked: false, pantry_item: pantryItem.id });
const tick = (row, checked) => api(token, "PATCH", `/collections/shopping_items/records/${row.id}`, { checked });

// The first packet with a size or brand becomes the item's usual packet.
const flour = await item("Restock flour");
await api(token, "POST", "/collections/pantry_packets/records", { item: flour.id, brand: "White Mill", size: "1 kg" });
const remembered = (await getItem(flour.id)).usual_packet;
check("a packet added becomes the item's usual one", remembered?.brand === "White Mill" && remembered?.size === "1 kg");

// It runs out (its packets go), then is bought again.
await api(token, "PATCH", `/collections/pantry_items/records/${flour.id}`, { status: "out", ask_about_list: true });
check("...and is still remembered once its packets are gone", (await packetsOf(flour.id)).length === 0 && (await getItem(flour.id)).usual_packet?.size === "1 kg");
const row = await onList(flour, "Plain flour");
await tick(row, true);
const bought = await packetsOf(flour.id);
check("ticking it bought adds a packet like the usual one", bought.length === 1 && bought[0].brand === "White Mill" && bought[0].size === "1 kg");
check("...marked with the shopping item that added it", bought[0]?.bought_with === row.id);
check("...and the item is Have again", (await getItem(flour.id)).status === "have");

await tick(row, false);
check("unticking takes that packet back off", (await packetsOf(flour.id)).length === 0);

// Bought while some is still in: one more packet.
await api(token, "POST", "/collections/pantry_packets/records", { item: flour.id, brand: "Coles", size: "2 kg" });
check("a later one doesn't replace the usual one (only a person does)", (await getItem(flour.id)).usual_packet?.brand === "White Mill");
await tick(row, true);
check("buying more while some is in adds one more", (await packetsOf(flour.id)).length === 2);
await tick(row, false);
const left = await packetsOf(flour.id);
check("...and unticking leaves the packet that was already there", left.length === 1 && left[0].brand === "Coles" && !left[0].bought_with);

// A tick sent again (the offline queue after a lost reply), or a ticked row
// edited, adds nothing more.
const oil = await item("Restock oil");
await api(token, "POST", "/collections/pantry_packets/records", { item: oil.id, brand: "Cobram", size: "750 ml" });
await api(token, "PATCH", `/collections/pantry_items/records/${oil.id}`, { status: "out", ask_about_list: true });
const oilRow = await onList(oil, "Olive oil");
await tick(oilRow, true);
await tick(oilRow, true);
await api(token, "PATCH", `/collections/shopping_items/records/${oilRow.id}`, { text: "Olive oil, big bottle" });
check("a tick sent twice, or a ticked row edited, adds one packet", (await packetsOf(oil.id)).length === 1);

// Items that don't use packets never get any.
const salt = await item("Restock salt", "low");
const saltRow = await onList(salt, "Salt");
await tick(saltRow, true);
check("an item that never had packets gets none when bought", (await packetsOf(salt.id)).length === 0 && (await getItem(salt.id)).status === "have");

// A packet with no brand or size doesn't replace the usual one.
await api(token, "POST", "/collections/pantry_packets/records", { item: flour.id });
check("a packet with no brand or size leaves the usual one", (await getItem(flour.id)).usual_packet?.brand === "White Mill");

// Checks packets in stock (the pantry_packets migration, and pantry.pb.js
// clearing them when an item runs out) against a throwaway PocketBase on
// :8091 (set it up as pantry-rules.check.mjs says). Never point this at the
// real server: it creates test accounts, pantry items and packets.
//   node test/packets.check.mjs
// Every line should say PASS.
const B = `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api`;
async function api(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    const error = new Error(`${method} ${path} -> ${res.status} ${text}`);
    error.status = res.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
const fails = async (call) => {
  try {
    await call();
    return 0;
  } catch (e) {
    return e.status;
  }
};

const admin = (await api("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
const run = Date.now();
const username = `pk${run}`;
await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: username });
const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });

const item = (name) => api(token, "POST", "/collections/pantry_items/records", { name: `${name} ${run}`, status: "have" });
const packet = (itemId, brand, size, barcode = "") =>
  api(token, "POST", "/collections/pantry_packets/records", { item: itemId, brand, size, barcode });
const packetsOf = async (itemId) =>
  (await api(token, "GET", `/collections/pantry_packets/records?filter=${encodeURIComponent(`item = "${itemId}"`)}`)).items;

const flour = await item("Packet flour");
await packet(flour.id, "White Mill", "1 kg", "9300633603161");
await packet(flour.id, "Coles", "2 kg");
check("an item can have several packets", (await packetsOf(flour.id)).length === 2);
check("a packet needs an item", (await fails(() => api(token, "POST", "/collections/pantry_packets/records", { brand: "Coles" }))) === 400);

const details = { "9300633603161": { brand: "White Mill", size: "1 kg" } };
const remembered = await api(token, "PATCH", `/collections/pantry_items/records/${flour.id}`, { barcode_details: details });
check("an item remembers its barcodes' brand and size", remembered.barcode_details?.["9300633603161"]?.size === "1 kg");

await api(token, "PATCH", `/collections/pantry_items/records/${flour.id}`, { status: "low" });
check("Low keeps the packets", (await packetsOf(flour.id)).length === 2);
await api(token, "PATCH", `/collections/pantry_items/records/${flour.id}`, { status: "out", ask_about_list: true });
check("Out clears its packets", (await packetsOf(flour.id)).length === 0);

// Apps from before packets (no ask_about_list) clear them too.
const sugar = await item("Packet sugar");
const rice = await item("Packet rice");
await packet(sugar.id, "CSR", "1 kg");
await packet(rice.id, "SunRice", "5 kg");
await api(token, "PATCH", `/collections/pantry_items/records/${sugar.id}`, { status: "out" });
check("...from older apps too", (await packetsOf(sugar.id)).length === 0);
check("...and only that item's", (await packetsOf(rice.id)).length === 1);

await packet(sugar.id, "CSR", "1 kg");
await api(token, "PATCH", `/collections/pantry_items/records/${sugar.id}`, { status: "have" });
check("packets added back (Undo) stay once it's in stock again", (await packetsOf(sugar.id)).length === 1);

await api(token, "DELETE", `/collections/pantry_items/records/${rice.id}`);
const orphans = await api(admin, "GET", `/collections/pantry_packets/records?filter=${encodeURIComponent(`item = "${rice.id}"`)}`);
check("removing an item removes its packets", orphans.items.length === 0);

const guest = await api("", "GET", "/collections/pantry_packets/records");
check("someone not logged in sees no packets", guest.items.length === 0);
check("...and can't add one", [400, 401, 403].includes(await fails(() => api("", "POST", "/collections/pantry_packets/records", { item: sugar.id }))));

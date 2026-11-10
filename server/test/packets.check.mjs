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

// Another brand bought because the favourite was out doesn't become the
// usual one: the next one bought should be the favourite again.
const mustard = await api(token, "POST", "/collections/pantry_items/records", { name: `Mustard ${run}`, status: "have", brand: "Masterfoods" });
await api(token, "POST", "/collections/pantry_packets/records", { item: mustard.id, brand: "Masterfoods", size: "560 g" });
await api(token, "POST", "/collections/pantry_packets/records", { item: mustard.id, brand: "Heinz", size: "500 g" });
const usualNow = (await api(token, "GET", `/collections/pantry_items/records/${mustard.id}`)).usual_packet;
check("a stand-in brand doesn't replace the usual one", usualNow?.brand === "Masterfoods" && usualNow?.size === "560 g", JSON.stringify(usualNow));
await api(token, "POST", "/collections/pantry_packets/records", { item: mustard.id, brand: "masterfoods", size: "250 g" });
const usualSmaller = (await api(token, "GET", `/collections/pantry_items/records/${mustard.id}`)).usual_packet;
check("...nor does the favourite in another size", usualSmaller?.size === "560 g", JSON.stringify(usualSmaller));
// Picking the favourite ("☆ Make favourite") is the app saving the item.
await api(token, "PATCH", `/collections/pantry_items/records/${mustard.id}`, { usual_packet: { brand: "Masterfoods", size: "250 g" } });
await api(token, "POST", "/collections/pantry_packets/records", { item: mustard.id, brand: "Masterfoods", size: "560 g" });
const picked = (await api(token, "GET", `/collections/pantry_items/records/${mustard.id}`)).usual_packet;
check("a favourite someone picked stays picked", picked?.size === "250 g", JSON.stringify(picked));

// Labels: each one in stock has its own use-by, opened and bought date; the
// item's use-by is the soonest of theirs (pantry_labels.js).
const itemNow = (id) => api(token, "GET", `/collections/pantry_items/records/${id}`);
const jam = await api(token, "POST", "/collections/pantry_items/records", { name: `Jam ${run}`, status: "have", expires: "2026-12-20 00:00:00.000Z" });
const first = await api(token, "POST", "/collections/pantry_packets/records", { item: jam.id, brand: "Bonne", size: "370 g" });
const firstNow = await api(token, "GET", `/collections/pantry_packets/records/${first.id}`);
check("the first label takes over the item's use-by date", firstNow.expires.startsWith("2026-12-20"), firstNow.expires);
const second = await api(token, "POST", "/collections/pantry_packets/records", { item: jam.id, brand: "Bonne", size: "370 g", expires: "2026-11-30 00:00:00.000Z" });
check("the item's date is the soonest label's", (await itemNow(jam.id)).expires.startsWith("2026-11-30"), (await itemNow(jam.id)).expires);
const openedOne = await api(token, "PATCH", `/collections/pantry_packets/records/${second.id}`, { opened: "2026-11-09 10:00:00.000Z" });
check("a label keeps the day it was opened", openedOne.opened.startsWith("2026-11-09"), openedOne.opened);
await api(token, "DELETE", `/collections/pantry_packets/records/${second.id}`);
const afterUse = await itemNow(jam.id);
check("using up the soonest one: back to the other's date", afterUse.expires.startsWith("2026-12-20"), afterUse.expires);
await api(token, "POST", "/collections/pantry_packets/records", { item: jam.id, expires: "2026-11-25 00:00:00.000Z" });
await api(token, "PATCH", `/collections/pantry_items/records/${jam.id}`, { status: "out", ask_about_list: true });
const outJam = await itemNow(jam.id);
const jamLabels = await api(token, "GET", `/collections/pantry_packets/records?filter=${encodeURIComponent(`item = "${jam.id}"`)}`);
check("running out clears its labels and its date, without one coming back", outJam.expires === "" && jamLabels.items.length === 0, JSON.stringify([outJam.expires, jamLabels.items.length]));
// Out's Undo: the labels go back first, while it's still Out, each with its
// own dates, then the item's status and date.
const putBack = await api(token, "POST", "/collections/pantry_packets/records", { item: jam.id, expires: "2026-12-01 00:00:00.000Z" });
const stillOut = await itemNow(jam.id);
const boughtOne = await api(token, "POST", "/collections/pantry_packets/records", { item: jam.id, bought: "2026-11-02 00:00:00.000Z" });
check("a label keeps the day it was bought", boughtOne.bought.startsWith("2026-11-02"), boughtOne.bought);
check("a label put back on an Out item keeps its date, and the item stays dateless", putBack.expires.startsWith("2026-12-01") && stillOut.expires === "", JSON.stringify([putBack.expires, stillOut.expires]));
const undone = await api(token, "PATCH", `/collections/pantry_items/records/${jam.id}`, { status: "have", expires: "2026-12-01 00:00:00.000Z" });
const undoneLabels = await packetsOf(jam.id);
check(
  "...then the item back in stock with its date: the labels keep theirs",
  (await itemNow(jam.id)).expires.startsWith("2026-12-01") && undoneLabels.filter((l) => l.expires).length === 1,
  JSON.stringify([undone.expires, undoneLabels.map((l) => l.expires)])
);

// A label's use-by changed later (the date box on a label, "+ Use-by" after
// a scan) brings the item's along.
const beans = await item("Beans");
const tin = await packet(beans.id, "Heinz", "420 g");
await api(token, "PATCH", `/collections/pantry_packets/records/${tin.id}`, { expires: "2027-01-10 00:00:00.000Z" });
const datedBeans = await itemNow(beans.id);
check("a label's use-by given later becomes the item's, and marks it dated", datedBeans.expires.startsWith("2027-01-10") && datedBeans.dates_used === true, JSON.stringify([datedBeans.expires, datedBeans.dates_used]));

// One added with a use-by while the item is Out (the edit form adds it, then
// saves the item as back in stock): the item gets its date once it's back.
await api(token, "PATCH", `/collections/pantry_items/records/${beans.id}`, { status: "out", ask_about_list: true });
await api(token, "POST", "/collections/pantry_packets/records", { item: beans.id, brand: "Heinz", size: "420 g", expires: "2027-02-01 00:00:00.000Z" });
await api(token, "PATCH", `/collections/pantry_items/records/${beans.id}`, { status: "have" });
const backBeans = await itemNow(beans.id);
check("a dated label added while Out gives the item its date once it's back", backBeans.expires.startsWith("2027-02-01"), backBeans.expires);

// An older app sets the item's own date, with labels counted: it goes on the
// oldest label, so the next label change doesn't wipe it.
const oats = await item("Oats");
const oldest = await packet(oats.id, "Uncle Tobys", "1 kg");
const newer = await packet(oats.id, "Uncle Tobys", "1 kg");
await api(token, "PATCH", `/collections/pantry_items/records/${oats.id}`, { expires: "2026-12-20 00:00:00.000Z" });
await api(token, "PATCH", `/collections/pantry_packets/records/${newer.id}`, { left: "half" });
const oatsNow = await itemNow(oats.id);
const oldestNow = await api(token, "GET", `/collections/pantry_packets/records/${oldest.id}`);
check(
  "an older app's date for the item survives the next label change, on its oldest label",
  oatsNow.expires.startsWith("2026-12-20") && oldestNow.expires.startsWith("2026-12-20"),
  JSON.stringify([oatsNow.expires, oldestNow.expires])
);

// ...but never over a label's own date: with every label dated, theirs
// stand, and the item says the soonest of them.
const tea = await item("Tea");
await api(token, "POST", "/collections/pantry_packets/records", { item: tea.id, expires: "2026-11-15 00:00:00.000Z" });
await api(token, "PATCH", `/collections/pantry_items/records/${tea.id}`, { expires: "2026-11-20 00:00:00.000Z" });
const teaNow = await itemNow(tea.id);
const teaLabels = await packetsOf(tea.id);
check(
  "an older app's date doesn't replace a label's own, and the item keeps the labels' date",
  teaNow.expires.startsWith("2026-11-15") && teaLabels[0]?.expires.startsWith("2026-11-15"),
  JSON.stringify([teaNow.expires, teaLabels.map((l) => l.expires)])
);

// A stand-in as the very first one counted doesn't become the usual one.
const sauce = await api(token, "POST", "/collections/pantry_items/records", { name: `Sauce ${run}`, status: "have", brand: "Masterfoods" });
await api(token, "POST", "/collections/pantry_packets/records", { item: sauce.id, brand: "Heinz", size: "500 ml" });
const sauceUsual = (await itemNow(sauce.id)).usual_packet;
check("a stand-in brand counted first doesn't become the usual one", !sauceUsual?.brand && !sauceUsual?.size, JSON.stringify(sauceUsual));

const guest = await api("", "GET", "/collections/pantry_packets/records");
check("someone not logged in sees no packets", guest.items.length === 0);
check("...and can't add one", [400, 401, 403].includes(await fails(() => api("", "POST", "/collections/pantry_packets/records", { item: sugar.id }))));

// Checks the shopping lists' rules (pb_migrations/1765411200_shopping_lists.js):
// there's one main list, made by the migration, which the app can't delete
// or make another of; a new list can be made, renamed and deleted, and
// deleting it deletes the rows on it; a row with no list (an older app)
// still saves. Against a throwaway PocketBase on :8091 (set it up as
// pantry-rules.check.mjs says). Never point this at the real server: it
// creates test accounts, lists and shopping items.
//   node test/shopping-lists.check.mjs
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
const refused = async (run) => {
  try {
    await run();
    return 0;
  } catch (err) {
    return err.status;
  }
};

const admin = (await api("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
const run = Date.now();
const username = `lists${run}`;
await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: username });
const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });

const mains = (await api(token, "GET", `/collections/shopping_lists/records?filter=${encodeURIComponent("main = true")}`)).items;
check("there's one main list, made by the migration", mains.length === 1 && mains[0].name === "Shopping list", JSON.stringify(mains.map((l) => l.name)));
const main = mains[0];

check("the main list can't be deleted", (await refused(() => api(token, "DELETE", `/collections/shopping_lists/records/${main.id}`))) >= 400);
check("...but can be renamed", (await api(token, "PATCH", `/collections/shopping_lists/records/${main.id}`, { name: "Weekly shop" })).name === "Weekly shop");
await api(token, "PATCH", `/collections/shopping_lists/records/${main.id}`, { name: "Shopping list" });
check("the app can't make another main list", (await refused(() => api(token, "POST", "/collections/shopping_lists/records", { name: `Sneaky ${run}`, main: true }))) >= 400);
check("...nor unmake the main one", (await refused(() => api(token, "PATCH", `/collections/shopping_lists/records/${main.id}`, { main: false }))) >= 400);

const party = await api(token, "POST", "/collections/shopping_lists/records", { name: `Party ${run}` });
check("a list can be made, and says who made it", party.name === `Party ${run}` && !party.main && party.added_by);
const onParty = await api(token, "POST", "/collections/shopping_items/records", { text: `Candles ${run}`, checked: false, list: party.id });
const older = await api(token, "POST", "/collections/shopping_items/records", { text: `Milk ${run}`, checked: false });
check("a row with no list (an older app) still saves, on no list", older.list === "");

await api(token, "DELETE", `/collections/shopping_lists/records/${party.id}`);
const gone = await refused(() => api(token, "GET", `/collections/shopping_items/records/${onParty.id}`));
check("deleting a list deletes the rows on it", gone === 404, String(gone));
check("...and not the others", (await api(token, "GET", `/collections/shopping_items/records/${older.id}`)).id === older.id);
await api(token, "DELETE", `/collections/shopping_items/records/${older.id}`);

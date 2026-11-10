// Checks that a shopping list item can be saved under an id the app picked,
// and that the same one sent twice isn't added twice (the app sends again
// what it added offline when its first answer was lost: offlineShopping.ts),
// against a throwaway PocketBase on :8091 (set it up as
// pantry-rules.check.mjs says). Never point this at the real server: it
// creates test accounts and shopping items.
//   node test/shopping-ids.check.mjs
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

const admin = (await api("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
const run = Date.now();
const username = `ids${run}`;
await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: username });
const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });

// 15 lower-case letters and digits, like the app's newRecordId.
const id = `s${String(run).slice(-10)}abcd`.slice(0, 15);
const text = `Milk ${run}`;
const first = await api(token, "POST", "/collections/shopping_items/records", { id, text, checked: false });
check("an item is saved under the id the app picked", first.id === id);
let status = 0;
try {
  await api(token, "POST", "/collections/shopping_items/records", { id, text, checked: false });
} catch (err) {
  status = err.status;
}
check("the same one sent again is refused (400), so the app counts it done", status === 400, String(status));
const rows = await api(token, "GET", `/collections/shopping_items/records?filter=${encodeURIComponent(`text = "${text}"`)}`);
check("...and it's on the list once", rows.items.length === 1, String(rows.items.length));
await api(token, "DELETE", `/collections/shopping_items/records/${id}`);

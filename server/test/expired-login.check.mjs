// What PocketBase answers when the app's login is no longer good, against a
// throwaway PocketBase on :8091 (set it up as pantry-rules.check.mjs says).
// The app relies on this (web/src/session.ts, offlineShopping.ts): a bad
// login gets 400 for an add and 404 for a tick, as if logged out, which
// look like "turned down for good"; only renewing the login says 401. So
// the app renews before sending changes made offline. If a PocketBase
// update changes these answers, those files need another look.
//   node test/expired-login.check.mjs
// Every line should say PASS.
const B = `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api`;
async function call(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

const admin = (await call("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).data.token;
const username = `expiry${Date.now()}`;
await call(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: "Expiry" });
const { token } = (await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" })).data;
const item = (await call(token, "POST", "/collections/shopping_items/records", { text: "Milk", checked: false })).data;
check("a good login can add", !!item?.id);

// The same token with a broken signature: what an expired or revoked login
// looks like to the server.
const bad = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
const add = await call(bad, "POST", "/collections/shopping_items/records", { text: "Bread", checked: false });
check("a bad login's add is answered 400, as if logged out", add.status === 400, `(${add.status})`);
const tick = await call(bad, "PATCH", `/collections/shopping_items/records/${item.id}`, { checked: true });
check("a bad login's tick is answered 404, as if logged out", tick.status === 404, `(${tick.status})`);
const refresh = await call(bad, "POST", "/collections/users/auth-refresh");
check("renewing a bad login is answered 401", refresh.status === 401, `(${refresh.status})`);
// The app only signs out on PocketBase's own refusal, told apart from a
// public Wi-Fi's "forbidden" page by its JSON answer (loginGuard.ts
// isServerRefusal).
check("its answer is PocketBase's JSON, saying 401", refresh.data?.status === 401 && typeof refresh.data?.message === "string", JSON.stringify(refresh.data));
const good = await call(token, "POST", "/collections/users/auth-refresh");
check("renewing a good login works", good.status === 200, `(${good.status})`);
const after = (await call(token, "GET", `/collections/shopping_items/records/${item.id}`)).data;
check("the bad login changed nothing", after.checked === false);

await call(admin, "DELETE", `/collections/shopping_items/records/${item.id}`);

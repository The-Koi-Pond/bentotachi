// Checks that "added by" and "cooked by" can't be faked, against a throwaway
// PocketBase on :8091 (set it up as pantry-rules.check.mjs says). Never point
// this at the real server: it creates test accounts and records.
//   node test/who-added.check.mjs
// Every line should say PASS.
const B = "http://127.0.0.1:8091/api";
async function api(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

const admin = (await api("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
const account = async (username) => {
  const user = await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: username });
  const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });
  return { id: user.id, token };
};
// New names each run, so it can run again on the same test server.
const run = Date.now();
const amy = await account(`amy${run}`);
const bo = await account(`bo${run}`);

const recipe = await api(amy.token, "POST", "/collections/recipes/records", { title: "Soup", added_by: bo.id });
check("a new recipe is added by whoever is logged in", recipe.added_by === amy.id);
const noName = await api(amy.token, "POST", "/collections/recipes/records", { title: "Stew" });
check("...also when the app doesn't say", noName.added_by === amy.id);
const edited = await api(bo.token, "PATCH", `/collections/recipes/records/${recipe.id}`, { title: "Better soup", added_by: bo.id });
check("editing keeps who added it", edited.added_by === amy.id && edited.title === "Better soup");

const item = await api(bo.token, "POST", "/collections/shopping_items/records", { text: "Milk", added_by: amy.id });
check("shopping items too", item.added_by === bo.id);
// A day no other check plans, taken off again at the end.
const night = await api(bo.token, "POST", "/collections/meal_plan/records", { date: "2033-01-01 00:00:00.000Z", note: "Takeaway", added_by: amy.id });
check("plan nights too", night.added_by === bo.id);
const site = await api(bo.token, "POST", "/collections/saved_sites/records", { name: "Example", url: "https://example.com", added_by: amy.id });
check("saved sites too", site.added_by === bo.id);
const cooked = await api(bo.token, "POST", "/collections/cooked/records", { date: "2026-11-02 00:00:00.000Z", recipe: recipe.id, cooked_by: amy.id });
check("cooked by whoever is logged in", cooked.cooked_by === bo.id);

const fixed = await api(admin, "PATCH", `/collections/recipes/records/${recipe.id}`, { added_by: bo.id });
check("the admin page can still change it", fixed.added_by === bo.id);
await api(admin, "DELETE", `/collections/meal_plan/records/${night.id}`);

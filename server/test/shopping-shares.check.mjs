// Checks shopping-list lines' shares (pb_migrations/1765497600_shopping_item_shares.js,
// pb_hooks/shopping.pb.js): a line keeps each recipe's share, an older
// app's line without shares still saves, and deleting a recipe keeps its
// share's words and title without its id, leaving other recipes' shares
// and other lines alone. Against a throwaway PocketBase on :8091 (set it up
// as pantry-rules.check.mjs says). Never point this at the real server: it
// creates test accounts, recipes and shopping items.
//   node test/shopping-shares.check.mjs
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
const username = `shares${run}`;
await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: username });
const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });

const tuscan = await api(token, "POST", "/collections/recipes/records", { title: `Tuscan stew ${run}` });
const beef = await api(token, "POST", "/collections/recipes/records", { title: `Beef stew ${run}` });
const shares = [
  { recipe: tuscan.id, title: tuscan.title, text: "3 garlic cloves" },
  { recipe: beef.id, title: beef.title, text: "2 garlic cloves" },
];
const garlic = await api(token, "POST", "/collections/shopping_items/records", { text: `5 garlic cloves ${run}`, checked: false, recipe: tuscan.id, shares });
// Field by field: the database keeps a share's fields in its own order.
const same = (a, b) => a.length === b.length && a.every((share, i) => ["recipe", "title", "text"].every((key) => share[key] === b[i][key]));
check("a line keeps each recipe's share", same(garlic.shares, shares), JSON.stringify(garlic.shares));
const older = await api(token, "POST", "/collections/shopping_items/records", { text: `2 carrots ${run}`, checked: false, recipe: tuscan.id });
check("an older app's line, without shares, still saves", older.id && !older.shares?.length, JSON.stringify(older.shares));
const beefOnly = await api(token, "POST", "/collections/shopping_items/records", {
  text: `3 carrots ${run}`,
  checked: false,
  recipe: beef.id,
  shares: [{ recipe: beef.id, title: beef.title, text: "3 carrots" }],
});

await api(token, "DELETE", `/collections/recipes/records/${tuscan.id}`);
const after = await api(token, "GET", `/collections/shopping_items/records/${garlic.id}`);
check(
  "deleting a recipe keeps its share's words and title, without its id",
  after.shares[0].recipe === "" && after.shares[0].title === tuscan.title && after.shares[0].text === "3 garlic cloves",
  JSON.stringify(after.shares[0])
);
check("...the other recipe's share is left alone", after.shares[1].recipe === beef.id);
check("...and the line's own recipe clears by itself", after.recipe === "");
const untouched = await api(token, "GET", `/collections/shopping_items/records/${beefOnly.id}`);
check("...and another recipe's line is left alone", untouched.shares[0].recipe === beef.id);

for (const id of [garlic.id, older.id, beefOnly.id]) await api(token, "DELETE", `/collections/shopping_items/records/${id}`);
await api(token, "DELETE", `/collections/recipes/records/${beef.id}`);

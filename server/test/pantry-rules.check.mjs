// End-to-end check of the pantry rules against a throwaway PocketBase on :8091.
// Never point this at the real server: it creates test accounts and items.
//
// From the server folder, with a fresh empty folder for the test data. The
// two Dir flags matter: without them PocketBase looks for the schema and
// rules next to <tmp> instead of in this project. --automigrate=false
// matters too: otherwise changing a collection's settings on the test
// server (like the login lifetime) writes a new migration file into
// pb_migrations, which would then change the real database (it happened
// on 2026-11-02: a file setting logins to expire after 10 seconds).
//   ./pocketbase.exe superuser upsert test@example.com testpassword123 --dir <tmp>/pb_data --migrationsDir ./pb_migrations --hooksDir ./pb_hooks
//   ./pocketbase.exe serve --http 127.0.0.1:8091 --automigrate=false --dir <tmp>/pb_data --migrationsDir ./pb_migrations --hooksDir ./pb_hooks --publicDir ./pb_public
// then, in another window:  node test/pantry-rules.check.mjs
// Every line should say PASS. Delete <tmp> afterwards.
const B = `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api`;
let token = "";
async function api(method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) { const e = new Error(`${method} ${path} -> ${res.status} ${text}`); e.status = res.status; e.data = data; throw e; }
  return data;
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
const waiting = async () => (await api("GET", "/collections/shopping_items/records?perPage=200&filter=" + encodeURIComponent("checked = false"))).items;

token = (await api("POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
await api("POST", "/collections/users/records", { username: "member", email: "member@example.com", password: "memberpass123", passwordConfirm: "memberpass123", name: "Member" });

// Accounts: usernames log in, emails are optional, usernames are unique and lowercase.
const superToken = token;
const noEmail = await api("POST", "/collections/users/records", { username: "noemail", password: "noemailpass1", passwordConfirm: "noemailpass1", name: "No Email" });
check("an account doesn't need an email", noEmail.username === "noemail");
token = "";
check("you can log in with a username", !!(await api("POST", "/collections/users/auth-with-password", { identity: "noemail", password: "noemailpass1" })).token);
check("you can still log in with an email", !!(await api("POST", "/collections/users/auth-with-password", { identity: "member@example.com", password: "memberpass123" })).token);
token = superToken;
try { await api("POST", "/collections/users/records", { username: "member", password: "anotherpass1", passwordConfirm: "anotherpass1" }); check("usernames are unique", false); }
catch (e) { check("usernames are unique", e.status === 400); }
try { await api("POST", "/collections/users/records", { username: "Shouty", password: "anotherpass1", passwordConfirm: "anotherpass1" }); check("usernames must be lowercase", false); }
catch (e) { check("usernames must be lowercase", e.status === 400); }
try { await api("POST", "/collections/users/records", { password: "anotherpass1", passwordConfirm: "anotherpass1" }); check("an account needs a username", false); }
catch (e) { check("an account needs a username", e.status === 400); }

token = (await api("POST", "/collections/users/auth-with-password", { identity: "member", password: "memberpass123" })).token;

// Sign-up is closed to the public.
const saved = token; token = "";
try { await api("POST", "/collections/users/records", { email: "x@example.com", password: "xxxxxxxx1", passwordConfirm: "xxxxxxxx1" }); check("public sign-up blocked", false); } catch (e) { check("public sign-up blocked", e.status >= 400, `(${e.status})`); }
token = saved;

const eggs = await api("POST", "/collections/pantry_items/records", { name: "Eggs", status: "have", location: "Fridge", subcategory: "Dairy" });
check("pantry item created with subcategory", eggs.subcategory === "Dairy");

try { await api("POST", "/collections/pantry_items/records", { name: "eggs", status: "have" }); check("duplicate name (different case) rejected", false); }
catch (e) { check("duplicate name (different case) rejected", e.status === 400, JSON.stringify(e.data?.data)); }

await api("PATCH", `/collections/pantry_items/records/${eggs.id}`, { status: "out" });
let list = await waiting();
const auto = list.filter((i) => i.pantry_item === eggs.id);
check("marking Out adds it to the shopping list", auto.length === 1 && auto[0].text === "Eggs");

await api("PATCH", `/collections/pantry_items/records/${eggs.id}`, { status: "low" });
await api("PATCH", `/collections/pantry_items/records/${eggs.id}`, { status: "out" });
list = await waiting();
check("marking Out again doesn't add a second one", list.filter((i) => i.pantry_item === eggs.id).length === 1);

await api("PATCH", `/collections/pantry_items/records/${eggs.id}`, { expires: "2026-11-02 00:00:00.000Z" });
let p = await api("GET", `/collections/pantry_items/records/${eggs.id}`);
check("an expiry date can be saved", p.expires.startsWith("2026-11-02"), p.expires);

await api("PATCH", `/collections/shopping_items/records/${auto[0].id}`, { checked: true });
p = await api("GET", `/collections/pantry_items/records/${eggs.id}`);
check("ticking it off sets the pantry back to Have", p.status === "have", p.status);
check("ticking it off clears the old expiry date", p.expires === "", JSON.stringify(p.expires));

await api("PATCH", `/collections/shopping_items/records/${auto[0].id}`, { checked: false });
p = await api("GET", `/collections/pantry_items/records/${eggs.id}`);
check("unticking it sets the pantry to Low", p.status === "low", p.status);

// More of something we still have (added from a recipe while the current one
// is in date, or set back to Have by hand with a new date): ticking it off
// leaves that date alone, since the older stock is still there.
for (const status of ["have", "low"]) {
  const butter = await api("POST", "/collections/pantry_items/records", {
    name: `Butter ${status}`,
    status,
    location: "Fridge",
    expires: "2026-11-09 00:00:00.000Z",
  });
  const more = await api("POST", "/collections/shopping_items/records", { text: `Butter ${status}`, checked: false, pantry_item: butter.id });
  await api("PATCH", `/collections/shopping_items/records/${more.id}`, { checked: true });
  const after = await api("GET", `/collections/pantry_items/records/${butter.id}`);
  check(`ticking off more of something ${status === "have" ? "we have" : "running low"} keeps its expiry date`, after.expires.startsWith("2026-11-09"), JSON.stringify(after.expires));
  check(`...and it's Have`, after.status === "have", after.status);
}

// Hand-typed "milk" already on the list, then pantry Milk marked Out.
const typed = await api("POST", "/collections/shopping_items/records", { text: "milk", checked: false });
const milk = await api("POST", "/collections/pantry_items/records", { name: "Milk", status: "have", location: "Fridge" });
await api("PATCH", `/collections/pantry_items/records/${milk.id}`, { status: "out" });
list = await waiting();
const milks = list.filter((i) => i.text.toLowerCase() === "milk");
check("hand-typed item gets linked instead of doubled", milks.length === 1 && milks[0].id === typed.id && milks[0].pantry_item === milk.id);
await api("PATCH", `/collections/shopping_items/records/${typed.id}`, { checked: true });
p = await api("GET", `/collections/pantry_items/records/${milk.id}`);
check("ticking the linked hand-typed item updates the pantry", p.status === "have", p.status);

// Deleting a pantry item leaves its shopping items in place, just unlinked.
const flour = await api("POST", "/collections/pantry_items/records", { name: "Flour", status: "have", location: "Cupboard", subcategory: "Baking" });
await api("PATCH", `/collections/pantry_items/records/${flour.id}`, { status: "out" });
const flourItem = (await waiting()).find((i) => i.pantry_item === flour.id);
await api("DELETE", `/collections/pantry_items/records/${flour.id}`);
const after = await api("GET", `/collections/shopping_items/records/${flourItem.id}`);
check("deleting a pantry item keeps the shopping item, unlinked", after.pantry_item === "", JSON.stringify(after.pantry_item));

// Ratings: everyone sees them all, each person only changes their own.
const memberToken = token;
// (Other people's emails are hidden, so ask the login who "me" is.)
const memberId = (await api("POST", "/collections/users/auth-refresh")).record.id;
token = (await api("POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
await api("POST", "/collections/users/records", { username: "other", email: "other@example.com", password: "otherpass123", passwordConfirm: "otherpass123", name: "Other" });
const otherToken = (await api("POST", "/collections/users/auth-with-password", { identity: "other@example.com", password: "otherpass123" })).token;
token = memberToken;
const soup = await api("POST", "/collections/recipes/records", { title: "Soup" });
const myRating = await api("POST", "/collections/recipe_ratings/records", { recipe: soup.id, user: memberId, stars: 4, favorite: true, approved: true });
check("you can rate a recipe", myRating.stars === 4 && myRating.favorite && myRating.approved);

try { await api("POST", "/collections/recipe_ratings/records", { recipe: soup.id, user: memberId, stars: 5 }); check("you can't rate the same recipe twice", false); }
catch (e) { check("you can't rate the same recipe twice", e.status === 400); }

token = otherToken;
check("others can see your rating", (await api("GET", `/collections/recipe_ratings/records/${myRating.id}`)).stars === 4);
try { await api("PATCH", `/collections/recipe_ratings/records/${myRating.id}`, { stars: 1 }); check("others can't change your rating", false); }
catch (e) { check("others can't change your rating", e.status === 404 || e.status === 403, `(${e.status})`); }
try { await api("POST", "/collections/recipe_ratings/records", { recipe: soup.id, user: memberId, stars: 1 }); check("others can't rate in your name", false); }
catch (e) { check("others can't rate in your name", e.status === 400 || e.status === 403, `(${e.status})`); }
try { await api("DELETE", `/collections/recipe_ratings/records/${myRating.id}`); check("others can't delete your rating", false); }
catch (e) { check("others can't delete your rating", e.status === 404 || e.status === 403, `(${e.status})`); }

token = memberToken;
try { await api("PATCH", `/collections/recipe_ratings/records/${myRating.id}`, { user: "someoneelse1234" }); check("you can't hand your rating to someone else", false); }
catch (e) { check("you can't hand your rating to someone else", e.status === 404 || e.status === 403 || e.status === 400, `(${e.status})`); }
check("you can change your own rating", (await api("PATCH", `/collections/recipe_ratings/records/${myRating.id}`, { stars: 5 })).stars === 5);
const down = await api("PATCH", `/collections/recipe_ratings/records/${myRating.id}`, { disliked: true, approved: false, dislike_reasons: ["baked pineapple", "too sweet"] });
check("you can give a thumbs down with reasons", down.disliked && down.dislike_reasons.length === 2);
token = otherToken;
check("others can see your thumbs-down reasons", (await api("GET", `/collections/recipe_ratings/records/${myRating.id}`)).dislike_reasons[0] === "baked pineapple");
try { await api("PATCH", `/collections/recipe_ratings/records/${myRating.id}`, { dislike_reasons: [] }); check("others can't change your reasons", false); }
catch (e) { check("others can't change your reasons", e.status === 404 || e.status === 403, `(${e.status})`); }
token = memberToken;

await api("DELETE", `/collections/recipes/records/${soup.id}`);
const leftover = await api("GET", "/collections/recipe_ratings/records?filter=" + encodeURIComponent(`recipe = "${soup.id}"`));
check("deleting a recipe removes its ratings", leftover.items.length === 0, `(${leftover.items.length})`);

// Dinner plan: one dinner per night, and deleting a recipe takes it off the plan.
const curry = await api("POST", "/collections/recipes/records", { title: "Curry" });
const night = await api("POST", "/collections/meal_plan/records", { date: "2026-11-05 00:00:00.000Z", recipe: curry.id });
check("a dinner can be planned", night.recipe === curry.id);
try { await api("POST", "/collections/meal_plan/records", { date: "2026-11-05 00:00:00.000Z", recipe: curry.id }); check("only one dinner per night", false); }
catch (e) { check("only one dinner per night", e.status === 400); }
await api("DELETE", `/collections/recipes/records/${curry.id}`);
const nightAfter = await api("GET", "/collections/meal_plan/records?filter=" + encodeURIComponent(`id = "${night.id}"`));
check("deleting a recipe takes it off the plan", nightAfter.items.length === 0, `(${nightAfter.items.length})`);
const noteNight = await api("POST", "/collections/meal_plan/records", { date: "2026-11-06 00:00:00.000Z", note: "Take-away night" });
check("a night can be a note instead of a recipe", noteNight.note === "Take-away night" && noteNight.recipe === "");
try { await api("POST", "/collections/meal_plan/records", { date: "2026-11-07 00:00:00.000Z", note: "   " }); check("a night can't be blank", false); }
catch (e) { check("a night can't be blank", e.status === 400, e.data?.message); }

// Our own recipe sites on the Browse tab.
const site = await api("POST", "/collections/saved_sites/records", { name: "Smitten Kitchen", url: "https://smittenkitchen.com/" });
check("a recipe site can be saved", site.name === "Smitten Kitchen");
try { await api("POST", "/collections/saved_sites/records", { name: "Not a site", url: "lasagne" }); check("a saved site needs a real address", false); }
catch (e) { check("a saved site needs a real address", e.status === 400); }

// Pantry items can link to their product page in a store.
token = memberToken;
const sauce = await api("POST", "/collections/pantry_items/records", { name: "Worcestershire", status: "have", store_url: "https://www.coles.com.au/product/lea-perrins-worcestershire-sauce-250ml-123" });
check("a pantry item can have a store link", sauce.store_url.includes("coles.com.au"));
try { await api("PATCH", `/collections/pantry_items/records/${sauce.id}`, { store_url: "coles sauce" }); check("a store link must be a web address", false); }
catch (e) { check("a store link must be a web address", e.status === 400); }
check("a pantry item can have a preferred brand", (await api("PATCH", `/collections/pantry_items/records/${sauce.id}`, { brand: "Lea & Perrins" })).brand === "Lea & Perrins");

// Household: members can add each other (the Household page).
token = memberToken;
const housemate = await api("POST", "/collections/users/records", { username: "housemate", name: "Housemate", password: "housemate123", passwordConfirm: "housemate123" });
check("a member can add someone to the household", housemate.username === "housemate");
check("a set-up server doesn't offer setup again", (await api("GET", "/cookbook/setup")).needsSetup === false);
const superusersNow = (await (await fetch(B + "/collections/_superusers/records", { headers: { authorization: superToken } })).json()).items.map((s) => s.email);
check("servers that already have an admin get no placeholder admin", !superusersNow.includes("admin@bento.local"), superusersNow.join(", "));

// Profiles: you can change your own name and password, and nobody else's.
token = memberToken;
const me = (await api("POST", "/collections/users/auth-refresh")).record;
check("you can change your display name", (await api("PATCH", `/collections/users/records/${me.id}`, { name: "Mem" })).name === "Mem");
const otherUser = (await api("GET", "/collections/users/records?filter=" + encodeURIComponent('username = "other"'))).items[0];
try { await api("PATCH", `/collections/users/records/${otherUser.id}`, { name: "Hacked" }); check("you can't change someone else's profile", false); }
catch (e) { check("you can't change someone else's profile", e.status === 404 || e.status === 403, `(${e.status})`); }
try { await api("PATCH", `/collections/users/records/${me.id}`, { oldPassword: "wrongpass123", password: "newpass1234", passwordConfirm: "newpass1234" }); check("changing your password needs the current one", false); }
catch (e) { check("changing your password needs the current one", e.status === 400); }
await api("PATCH", `/collections/users/records/${me.id}`, { oldPassword: "memberpass123", password: "newpass1234", passwordConfirm: "newpass1234" });
token = "";
check("the new password works", !!(await api("POST", "/collections/users/auth-with-password", { identity: "member", password: "newpass1234" })).token);

// Logged-out visitors can't see anything.
token = "";
const anon = await api("GET", "/collections/pantry_items/records");
check("logged-out visitors see no pantry items", anon.items.length === 0, `(${anon.items.length})`);
const anonRatings = await api("GET", "/collections/recipe_ratings/records");
check("logged-out visitors see no ratings", anonRatings.items.length === 0, `(${anonRatings.items.length})`);
const anonPlan = await api("GET", "/collections/meal_plan/records");
check("logged-out visitors see no dinner plan", anonPlan.items.length === 0, `(${anonPlan.items.length})`);
const anonSites = await api("GET", "/collections/saved_sites/records");
check("logged-out visitors see no saved sites", anonSites.items.length === 0, `(${anonSites.items.length})`);

// Checks breakfast, lunch and dinner on the plan against a throwaway
// PocketBase on :8091 (set it up as pantry-rules.check.mjs says). Never point
// this at the real server: it creates test accounts and plan entries.
//   node test/meals.check.mjs
// Every line should say PASS.
const B = "http://127.0.0.1:8091/api";
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
const username = `meals${Date.now()}`;
await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: "Meals" });
const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });

const old = await api(token, "GET", "/collections/meal_plan/records?perPage=500");
check("everything planned before is a dinner", old.items.every((entry) => entry.meal === "dinner"), `(${old.items.length} entries)`);

// A date far from any other test's.
const date = "2031-03-04 00:00:00.000Z";
const fromOldApp = await api(token, "POST", "/collections/meal_plan/records", { date, note: "Soup" });
check("an app that sends no meal plans a dinner", fromOldApp.meal === "dinner");
const lunch = await api(token, "POST", "/collections/meal_plan/records", { date, meal: "lunch", note: "Sandwiches" });
check("lunch on the same day as dinner", lunch.meal === "lunch");
const breakfast = await api(token, "POST", "/collections/meal_plan/records", { date, meal: "breakfast", note: "Porridge" });
check("breakfast too", breakfast.meal === "breakfast");
try {
  await api(token, "POST", "/collections/meal_plan/records", { date, meal: "lunch", note: "Another lunch" });
  check("one lunch a day", false);
} catch (e) {
  check("one lunch a day", e.status === 400);
}
try {
  await api(token, "POST", "/collections/meal_plan/records", { date, meal: "supper", note: "?" });
  check("only breakfast, lunch and dinner", false);
} catch (e) {
  check("only breakfast, lunch and dinner", e.status === 400);
}
const moved = await api(token, "PATCH", `/collections/meal_plan/records/${lunch.id}`, { date: "2031-03-05 00:00:00.000Z", meal: "dinner" });
check("a lunch can move to another day's dinner", moved.meal === "dinner" && moved.date.startsWith("2031-03-05"));
try {
  await api(token, "POST", "/collections/meal_plan/records", { date, meal: "lunch" });
  check("a meal still needs a recipe or a note", false);
} catch (e) {
  check("a meal still needs a recipe or a note", e.status === 400);
}

const settings = await api(token, "GET", "/collections/household_settings/records?perPage=1");
const record = settings.items[0] ?? (await api(token, "POST", "/collections/household_settings/records", { country: "AU" }));
const chosen = await api(token, "PATCH", `/collections/household_settings/records/${record.id}`, { plan_meals: ["lunch", "dinner"] });
check("the household can choose its meals", JSON.stringify(chosen.plan_meals) === JSON.stringify(["lunch", "dinner"]));
await api(token, "PATCH", `/collections/household_settings/records/${record.id}`, { plan_meals: [] });

for (const entry of [fromOldApp, moved, breakfast]) await api(token, "DELETE", `/collections/meal_plan/records/${entry.id}`);

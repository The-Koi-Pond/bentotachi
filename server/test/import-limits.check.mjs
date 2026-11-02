// Importing a recipe whose text is longer than the database keeps, against
// a throwaway PocketBase on :8091 (set it up as pantry-rules.check.mjs says).
// Sends the page itself ("html", as the app's built-in browser does), so no
// website is needed. Before 2026-11-02 one over-long field made the whole
// import fail; now it's cut to fit (recipe_parse.js fitRecipe).
//   node test/import-limits.check.mjs
// Every line should say PASS.
const B = "http://127.0.0.1:8091/api";
async function call(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

const admin = (await call("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).data.token;
const username = `importer${Date.now()}`;
await call(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: "Importer" });
const { token } = (await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" })).data;

const recipe = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "The very best pumpkin soup ".repeat(20),
  description: "This soup reminds me of my grandmother's kitchen. ".repeat(120),
  recipeYield: "Serves ".repeat(30),
  recipeIngredient: ["1 kg pumpkin", "1 onion"],
  recipeInstructions: Array.from({ length: 4000 }, (_, i) => ({ "@type": "HowToStep", text: `Step ${i + 1}: stir gently and taste as you go.` })),
};
const html = `<html><head><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body></body></html>`;
const imported = await call(token, "POST", "/cookbook/import", { url: "https://example.com/long-soup", html });
check("a recipe with over-long text still imports", imported.status === 200 && !!imported.data?.id, `(${imported.status} ${imported.data?.message ?? ""})`);

if (imported.data?.id) {
  const saved = (await call(token, "GET", `/collections/recipes/records/${imported.data.id}`)).data;
  check("its title is cut to 300 characters", [...saved.title].length <= 300 && saved.title.endsWith("…"), `(${[...saved.title].length})`);
  check("its description is cut to 5,000", [...saved.description].length <= 5000 && saved.description.endsWith("…"), `(${[...saved.description].length})`);
  check("its servings are cut to 100", [...saved.servings].length <= 100, `(${[...saved.servings].length})`);
  check("it keeps its ingredients", JSON.stringify(saved.ingredients) === JSON.stringify(["1 kg pumpkin", "1 onion"]));
  check("it keeps as many steps as fit, from the start", saved.steps.length > 1000 && saved.steps[0].startsWith("Step 1:"), `(${saved.steps.length} steps; first: ${saved.steps[0]})`);
  await call(admin, "DELETE", `/collections/recipes/records/${imported.data.id}`);
}

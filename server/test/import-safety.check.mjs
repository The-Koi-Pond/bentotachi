// The import route never fetches from this computer or the home network
// (safe_url.js), even when the page itself names such an address for its
// photos, against a throwaway PocketBase on :8091 (set it up as
// pantry-rules.check.mjs says). The test server stands in for a home device.
//   node test/import-safety.check.mjs
// Every line should say PASS.
const PORT = process.env.BENTO_TEST_PORT || 8091;
const B = `http://127.0.0.1:${PORT}/api`;
async function call(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

const admin = (await call("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).data.token;
const run = Date.now();
const username = `safeimport${run}`;
const user = (await call(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: "Safe importer" })).data;
// Step photos are only brought for people who turned them on.
await call(admin, "PATCH", `/collections/users/records/${user.id}`, { website_step_photos: true });
const { token } = (await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" })).data;

const home = await call(token, "POST", "/cookbook/import", { url: `http://127.0.0.1:${PORT}/api/health` });
check("import refuses a page on the home network", home.status === 400 && /own network/.test(home.data?.message ?? ""), `(${home.status} ${home.data?.message ?? ""})`);

// A real photo on the test server, so a fetch that slipped through would
// save it (a 1x1 PNG).
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const form = new FormData();
form.append("title", `Safe import photo ${run}`);
form.append("image", new Blob([png], { type: "image/png" }), "dot.png");
const holder = await (await fetch(`${B}/collections/recipes/records`, { method: "POST", headers: { authorization: token }, body: form })).json();
const local = `${B}/files/${holder.collectionId}/${holder.id}/${holder.image}`;
const reach = await fetch(local);
check("(setup) the test server serves that photo", reach.ok && (reach.headers.get("content-type") ?? "").startsWith("image/"), `(${reach.status} ${reach.headers.get("content-type")})`);

const html = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@type": "Recipe",
  name: `Safe import soup ${run}`,
  image: local,
  recipeIngredient: ["1 onion"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Chop the onion.", image: `${local}?step=1` },
    { "@type": "HowToStep", text: "Cook it." },
  ],
})}</script></head><body></body></html>`;
const saved = await call(token, "POST", "/cookbook/import", { url: `https://example.org/safe-import-${run}`, html });
const recipe = saved.data?.id ? (await call(token, "GET", `/collections/recipes/records/${saved.data.id}`)).data : null;
check("a page naming home-network photos still imports", saved.status === 200 && !!recipe, `(${saved.status} ${saved.data?.message ?? ""})`);
check("without fetching its cover photo", !!recipe && !recipe.image, `(image=${recipe?.image})`);
check("or its step photos", !!recipe && !recipe.photos?.length, `(photos=${JSON.stringify(recipe?.photos)})`);
// who_added.pb.js only runs on the usual record routes, so this route sets it.
check("an imported recipe is added by whoever imported it", recipe?.added_by === user.id, `(${recipe?.added_by})`);

for (const id of [holder.id, saved.data?.id].filter(Boolean)) await call(admin, "DELETE", `/collections/recipes/records/${id}`);

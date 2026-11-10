// The importer reads big and badly made pages quickly, inside PocketBase's
// own JavaScript engine (slower than Node's, and it gives up on regexes Node
// copes with), against a throwaway PocketBase on :8091 (set it up as
// pantry-rules.check.mjs says).
//   node test/import-speed.check.mjs
// Every line should say PASS.
const PORT = process.env.BENTO_TEST_PORT || 8091;
const B = `http://127.0.0.1:${PORT}/api`;
async function call(token, method, path, body) {
  const started = Date.now();
  let res;
  try {
    res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  } catch {
    // Gave up waiting: the FAIL line says how long.
    return { status: 0, data: null, ms: Date.now() - started };
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, ms: Date.now() - started };
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

const admin = (await call("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).data.token;
const run = Date.now();
const username = `speedimport${run}`;
await call(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: "Speedy importer" });
const { token } = (await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" })).data;

const recipe = (extra = {}) =>
  `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "Speed soup", recipeIngredient: ["1 egg", "2 cups flour"], recipeInstructions: ["Cook it all."], ...extra })}</script>`;
const scope = '<div itemscope itemtype="https://schema.org/Recipe"><h1 itemprop="name">Speed soup</h1>';
// Before, each of the crafted ones took the square of the page's size:
// minutes for these.
const pages = [
  ["a long recipe with markup in its steps", recipe({ recipeInstructions: Array.from({ length: 16000 }, (_, i) => `Step ${i}: stir <b>well</b> & taste.`) })],
  ["a long section heading in the recipe card", recipe() + '<div class="wprm-recipe-ingredients-container"><h3>' + "Sauce <i>x</i> ".repeat(16000) + "</h3><li>1 egg</li><li>2 cups flour</li></div>"],
  ["a page of unclosed tags", recipe() + "<a ".repeat(64000)],
  ["a page of unclosed scripts", recipe() + "<script ".repeat(64000)],
  ["unclosed spans in the notes box", recipe() + '<div class="wprm-recipe-notes">' + "<span ".repeat(64000) + "</div>"],
  ["unclosed microdata ingredients", scope + '<div itemprop="recipeIngredient">1 egg '.repeat(16000)],
];
for (const [shape, page] of pages) {
  const answer = await call(token, "POST", "/cookbook/import", { url: `https://example.com/speed-${run}-${pages.indexOf(page)}`, html: `<html><body>${page}</body></html>`, preview: true });
  check(`import reads ${shape} quickly`, answer.status === 200 && answer.ms < 5000 && !!answer.data?.recipe?.title, `(${answer.status}, ${answer.ms} ms)`);
}

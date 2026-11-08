// The import's "you already have this" answer (import.pb.js: 409 with the
// recipe, unless asked for another copy) and the recipe-photo route's
// refusals (recipe_photo.pb.js), against a throwaway PocketBase on :8091
// (set it up as pantry-rules.check.mjs says). Sends the pages themselves,
// so no website or internet is needed.
//   node test/duplicate-and-photo.check.mjs
// Every line should say PASS.
const B = `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api`;
async function call(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

const admin = (await call("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).data.token;
const username = `dupes${Date.now()}`;
await call(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: "Dupes" });
const { token } = (await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" })).data;

const html = (name) =>
  `<html><head><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Recipe", name, recipeIngredient: ["1 egg"], recipeInstructions: ["Cook it."] })}</script></head></html>`;
const count = async () => (await call(admin, "GET", "/collections/recipes/records?perPage=1")).data.totalItems;

// The "already here" answer.
const first = await call(token, "POST", "/cookbook/import", { url: "https://www.example.org/dupe-soup/", html: html("Dupe soup") });
check("a new page imports", first.status === 200 && !!first.data?.id, `(${first.status})`);
const before = await count();
const again = await call(token, "POST", "/cookbook/import", { url: "http://EXAMPLE.org/dupe-soup?utm_source=fb#top", html: html("Dupe soup") });
check(
  "the same page written differently answers 409 with the recipe",
  again.status === 409 && again.data?.id === first.data?.id && again.data?.title === "Dupe soup",
  `(${again.status} ${JSON.stringify(again.data)})`
);
check("the 409 has a message older apps show", typeof again.data?.message === "string" && again.data.message.includes("Dupe soup"));
check("the 409 saved nothing", (await count()) === before);
const copy = await call(token, "POST", "/cookbook/import", { url: "https://example.org/dupe-soup", html: html("Dupe soup"), again: true });
check("asking for another copy imports it", copy.status === 200 && copy.data?.id && copy.data.id !== first.data?.id, `(${copy.status})`);
const other = await call(token, "POST", "/cookbook/import", { url: "https://example.org/dupe-soup-2", html: html("Other soup") });
check("a different page on the same site imports", other.status === 200, `(${other.status} ${JSON.stringify(other.data)})`);
const pick = await call(token, "POST", "/cookbook/import", { url: "https://example.org/r?id=1", html: html("Id one") });
const pick2 = await call(token, "POST", "/cookbook/import", { url: "https://example.org/r?id=2", html: html("Id two") });
check("a query that picks the recipe makes a different page", pick.status === 200 && pick2.status === 200, `(${pick.status}, ${pick2.status})`);
// A site whose recipe pages are its front page plus a query (found in review).
await call(token, "POST", "/cookbook/import", { url: "https://wpsite.example.org/?p=123", html: html("Query soup") });
const queryAgain = await call(token, "POST", "/cookbook/import", { url: "https://wpsite.example.org/?p=123", html: html("Query soup") });
check("a front-page-plus-query link is caught too", queryAgain.status === 409, `(${queryAgain.status})`);
// An address with accented letters, which arrive %-encoded (found in review).
await call(token, "POST", "/cookbook/import", { url: "https://example.org/cr%C3%A8me-br%C3%BBl%C3%A9e", html: html("Crème brûlée") });
const accentAgain = await call(token, "POST", "/cookbook/import", { url: "https://example.org/cr%C3%A8me-br%C3%BBl%C3%A9e", html: html("Crème brûlée") });
check("a %-encoded address is caught too", accentAgain.status === 409, `(${accentAgain.status})`);
// "Re-import from the website" asks for a preview: the page's recipe back,
// nothing saved, even for a page already here.
const beforePreview = await count();
const preview = await call(token, "POST", "/cookbook/import", { url: "https://www.example.org/dupe-soup/", html: html("Dupe soup"), preview: true });
check(
  "a preview sends the recipe back, not a 409",
  preview.status === 200 && preview.data?.recipe?.title === "Dupe soup" && !preview.data?.id,
  `(${preview.status} ${JSON.stringify(preview.data).slice(0, 120)})`
);
check("a preview saves nothing", (await count()) === beforePreview);
const noAuth = await call("", "POST", "/cookbook/import", { url: "https://www.example.org/dupe-soup/", html: html("x") });
check("no 409 (or recipe name) for someone not logged in", noAuth.status === 401, `(${noAuth.status})`);

// The recipe-photo route's refusals: no website needed.
const photo = (t, url) => call(t, "POST", "/cookbook/recipe-photo", { url });
check("photo: needs a login", (await photo("", "https://example.org/a.jpg")).status === 401);
check("photo: refuses a non-web address", (await photo(token, "file:///etc/passwd")).status === 400);
const home = await photo(token, `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api/health`);
check("photo: refuses this computer", home.status === 400 && /public websites/.test(home.data?.message ?? ""), `(${home.status} ${home.data?.message ?? ""})`);
check("photo: refuses the home network", (await photo(token, "http://10.0.0.5/photo.jpg")).status === 400);

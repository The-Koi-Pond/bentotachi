// The categories route (categories.pb.js): a site's categories from its home
// page, and inside one its recipes to tick (those already here marked) and
// its own categories, against a throwaway PocketBase on :8091 (set it up as
// pantry-rules.check.mjs says). Pages are sent as "html", so no site is
// contacted.
//   node test/categories.check.mjs
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
const username = `categories${run}`;
await call(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: "Category browser" });
const { token } = (await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" })).data;

const site = `https://cats${run}.example`;
const home = `<html><body><header><nav>
  <a href="/category/dinner/">Dinner</a><a href="/category/barbecue/">Barbecue</a><a href="/about/">About</a>
</nav></header><main><p>Welcome</p></main></body></html>`;
const card = (slug, title) => `<article><h2><a href="${site}/${slug}/">${title}</a></h2></article>`;
const dinner = `<html><head><title>Dinner Archives - Cats</title></head><body><header><nav>
  <a href="/category/dinner/">Dinner</a><a href="/category/barbecue/">Barbecue</a>
</nav></header><main>${card("pho", "Pho")}${card("laksa", "Laksa")}</main></body></html>`;
const barbecue = `<html><body><header><nav><a href="/category/dinner/">Dinner</a></nav></header>
  <main><a href="/category/bbq-chicken/">Barbecue chicken</a><a href="/category/bbq-sides/">Barbecue sides</a></main></body></html>`;

const out = await call("", "POST", "/cookbook/categories", { url: `${site}/`, html: home });
check("the categories route needs a login", out.status === 401, `(${out.status})`);

const cats = await call(token, "POST", "/cookbook/categories", { url: `${site}/`, html: home });
check(
  "a home page gives its menu's categories",
  cats.status === 200 && JSON.stringify(cats.data?.categories?.map((c) => c.title)) === JSON.stringify(["Dinner", "Barbecue"]) && cats.data.list === null,
  `(${cats.status} ${JSON.stringify(cats.data)})`
);

// A recipe from the list already here shows as here.
const pho = (await call(token, "POST", "/collections/recipes/records", { title: `Pho ${run}`, source_url: `${site}/pho/` })).data;
const inside = await call(token, "POST", "/cookbook/categories", { url: `${site}/category/dinner/`, inside: true, html: dinner });
const listed = inside.data?.list?.recipes ?? [];
check(
  "inside a category: its recipes, the one already here marked",
  inside.status === 200 && listed.length === 2 && listed.find((r) => r.title === "Pho")?.have === true && listed.find((r) => r.title === "Laksa")?.have === false,
  `(${inside.status} ${JSON.stringify(inside.data)})`
);
check("and no categories (its one other menu link isn't a list of them)", inside.data?.categories?.length === 0, `(${JSON.stringify(inside.data?.categories)})`);

// With a few stray cards beside them (an offer, a podcast), which aren't
// recipes to tick.
const strays = barbecue.replace("<main>", `<main>${card("magazine-offer", "Magazine offer")}${card("podcast", "Our podcast")}`);
const nested = await call(token, "POST", "/cookbook/categories", { url: `${site}/category/barbecue/`, inside: true, html: strays });
check(
  "a category holding categories gives those, without its stray cards as recipes",
  nested.status === 200 && nested.data?.list === null && JSON.stringify(nested.data?.categories?.map((c) => c.title)) === JSON.stringify(["Barbecue chicken", "Barbecue sides"]),
  `(${nested.status} ${JSON.stringify(nested.data)})`
);

// Four recipes beside its categories are a real list, kept.
const four = barbecue.replace("<main>", `<main>${card("ribs", "Ribs")}${card("wings", "Wings")}${card("corn", "Corn")}${card("halloumi", "Halloumi")}`);
const mixed = await call(token, "POST", "/cookbook/categories", { url: `${site}/category/barbecue/`, inside: true, html: four });
check(
  "a category with sub-categories and four recipes keeps both",
  mixed.status === 200 && mixed.data?.list?.recipes?.length === 4 && mixed.data?.categories?.length === 2,
  `(${mixed.status} ${JSON.stringify(mixed.data)})`
);

// A big category page with thousands of links (and an accented letter
// outside its menus, which makes PocketBase's engine slower) is still read
// quickly: reading a copy of the page without its menus took 16 seconds
// for 20,000 links. Recipe links, so every one is read (categories stop at
// 300), and two categories so there's an answer.
const links = `<html><body><header><nav><a href="/category/a/">Menu</a></nav></header><main><p>Café</p>${Array.from(
  { length: 20000 },
  (_, i) => `<a href="/recipes/r${i}/">Recipe ${i}</a> `
).join("")}<a href="/category/big-one/">Big one</a><a href="/category/big-two/">Big two</a></main></body></html>`;
const started = Date.now();
const many = await call(token, "POST", "/cookbook/categories", { url: `${site}/category/big/`, inside: true, html: links });
const took = Date.now() - started;
check("a category page with 20,000 links is read in a few seconds", many.status === 200 && took < 4000, `(${many.status}, ${took} ms)`);

const none = await call(token, "POST", "/cookbook/categories", { url: `${site}/`, html: "<html><body><p>Hello</p></body></html>" });
check("a page without categories says to use the site's own menu", none.status === 400 && /own menu/.test(none.data?.message ?? ""), `(${none.status} ${none.data?.message})`);

const local = await call(token, "POST", "/cookbook/categories", { url: `http://127.0.0.1:${PORT}/` });
check("never reads a page on the home network", local.status === 400 && /own network/.test(local.data?.message ?? ""), `(${local.status} ${local.data?.message})`);

if (pho?.id) await call(admin, "DELETE", `/collections/recipes/records/${pho.id}`);

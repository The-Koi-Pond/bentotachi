// npm run style-check: did a stylesheet change alter how anything looks?
// Every element's styles on every screen, the committed stylesheets against
// the files as they are now, in a hidden browser on a throwaway server.
// `-- --quick` for phone width in light only, `-- --from <commit or tag>`.
// How it works and what it can't see: docs/shared-systems.md, "Styles".
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser } from "./headlessBrowser.mjs";
import { MEMBERS } from "./sandbox-data.mjs";
import { fillSandbox, sandboxCall, sandboxDay } from "./sandbox-fill.mjs";
import { startTestServer } from "./testServer.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(web, "..");
const PORT = Number(process.env.BENTO_STYLE_PORT) || 8097;
const base = `http://127.0.0.1:${PORT}/`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function options() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--from");
  const from = at < 0 ? "HEAD" : args[at + 1];
  if (!from || from.startsWith("--")) throw new Error("--from needs a commit or tag after it, like: --from v1.23.0");
  return { from, quick: args.includes("--quick") };
}

const CSS_IMPORT = /^\s*import\s+["']([^"']+\.css)["']/gm;

// The stylesheets main.tsx loads, joined in its order: as committed at
// `ref`, or (no ref) as the files are now.
function styles(ref) {
  const committed = (path) => {
    try {
      return execFileSync("git", ["show", `${ref}:web/src/${path}`], { cwd: root, encoding: "utf8", maxBuffer: 64e6, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      throw new Error(`Git has no web/src/${path} at ${ref}. Is ${ref} a commit or tag?`);
    }
  };
  const read = (path) => (ref ? committed(path) : readFileSync(join(web, "src", path), "utf8"));
  const files = [...read("main.tsx").matchAll(CSS_IMPORT)].map((match) => match[1].replace(/^\.\//, ""));
  if (!files.length) throw new Error(`No stylesheet imports found in main.tsx${ref ? ` at ${ref}` : ""}.`);
  return files.map(read).join("\n");
}

// A stylesheet loaded anywhere but main.tsx would be on neither side of the
// comparison, so a change to it could never show.
function refuseStrayStylesheets() {
  const walk = (folder) => readdirSync(folder).flatMap((name) => (statSync(join(folder, name)).isDirectory() ? walk(join(folder, name)) : [join(folder, name)]));
  const strays = walk(join(web, "src")).filter((file) => /\.tsx?$/.test(file) && !file.endsWith("main.tsx") && [...readFileSync(file, "utf8").matchAll(CSS_IMPORT)].length);
  if (strays.length) throw new Error(`These import a stylesheet outside main.tsx, which the check can't compare: ${strays.map((file) => relative(web, file)).join(", ")}. Load it from main.tsx, or teach styles() to find it.`);
}

// Each @keyframes by name. Animations are stilled while elements are
// compared, so the keyframes themselves are compared as text.
function keyframes(css) {
  const found = {};
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) found[match[1]] = match[2].replace(/\s+/g, " ").trim();
  return found;
}

function keyframeDifferences(before, after) {
  const [was, now] = [keyframes(before), keyframes(after)];
  return [...new Set([...Object.keys(was), ...Object.keys(now)])]
    .filter((name) => was[name] !== now[name])
    .map((name) => ({ where: "the stylesheets", what: `@keyframes ${name}`, changed: [!(name in now) ? "removed" : !(name in was) ? "added" : `${was[name]} -> ${now[name]}`], more: 0 }));
}

// The app, built into `folder`/app with the two sides of the comparison
// beside it for the page to fetch.
function build(folder, before, after) {
  console.log("Building the app...");
  const app = join(folder, "app");
  execSync(`npx vite build --outDir "${app}" --emptyOutDir --logLevel error`, { cwd: web, stdio: ["ignore", "ignore", "inherit"] });
  // The comparison pastes the stylesheets in as text, where a wrong path to
  // the font can't show; in the built one, an address Vite couldn't find
  // stays relative.
  for (const name of readdirSync(join(app, "assets")).filter((file) => file.endsWith(".css"))) {
    const unresolved = readFileSync(join(app, "assets", name), "utf8").match(/url\(["']?\.\.?\/[^)]*\)/);
    if (unresolved) throw new Error(`The built stylesheet still has a relative address, ${unresolved[0]}: a font or picture the stylesheets point at isn't where they say.`);
  }
  writeFileSync(join(app, "style-check-old.css"), before);
  writeFileSync(join(app, "style-check-new.css"), after);
  return app;
}

// The sandbox's made-up household (sandbox-fill.mjs), plus the things only
// some screens show, so those parts are on screen to be compared.
async function seed() {
  const api = `${base}api`;
  const { logins } = await fillSandbox(api);
  const username = MEMBERS[0].username;
  const { token, record: me } = logins[username];
  const call = (method, path, body) => sandboxCall(api, token, method, path, body);
  const make = (collection, body) => call("POST", `/collections/${collection}/records`, body);

  const recipe = await make("recipes", {
    title: "Creamy linguine",
    description: "A soft **weeknight** dinner that looks after itself. Good with ~crusty bread~.",
    servings: "4",
    prep_minutes: 10,
    cook_minutes: 30,
    total_minutes: 40,
    source_url: "https://www.example.com/recipes/creamy-linguine",
    ingredients: ["# Sauce", "2 cups milk", "200 g plain flour", "2 eggs", "# Pasta", "400 g linguine", "1 tbsp olive oil", "salt"],
    steps: ["# Sauce", "Whisk the milk and flour, then simmer for 10 minutes.", "Beat in the eggs off the heat.", "# Pasta", "Boil the linguine for 9 minutes.", "Toss together and rest 5 min."],
    tags: ["dinner", "pasta"],
    notes: "Ours: double the sauce.\n- less salt\n- more pepper",
    author_notes: "Keeps 3 days.",
    nutrition: ["Calories: 520", "Protein: 21 g"],
    site_rating: 4.6,
    site_rating_count: 120,
  });
  const photo = new FormData();
  photo.append("image", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")], { type: "image/png" }), "photo.png");
  const sent = await fetch(`${api}/collections/recipes/records/${recipe.id}`, { method: "PATCH", headers: { authorization: token }, body: photo });
  if (!sent.ok) throw new Error(`The made-up recipe's photo didn't save: ${sent.status}`);

  const pantry = (await call("GET", "/collections/pantry_items/records?perPage=200")).items;
  const flour = pantry.find((item) => item.name === "Plain flour");
  // A product on each, so whichever item is opened first has its list to show.
  for (const item of pantry) await call("PATCH", `/collections/pantry_items/records/${item.id}`, { products: [{ brand: "Mill & Co", size: "1 kg", barcodes: ["9300000000017"], links: [] }] });
  await make("pantry_packets", { item: flour.id, brand: "Mill & Co", size: "1 kg", expires: sandboxDay(40) });
  await make("pantry_packets", { item: flour.id, brand: "Mill & Co", size: "1 kg", opened: sandboxDay(-5), left: "half" });
  await make("pantry_items", { name: "Linguine", status: "have", location: "Cupboard", kind_of: "Pasta" });
  await make("pantry_items", { name: "Penne", status: "have", location: "Cupboard", kind_of: "Pasta" });
  await make("pantry_items", { name: "Yoghurt", status: "have", location: "Fridge", subcategory: "Dairy", expires: sandboxDay(-3), store_url: "https://www.example.com/yoghurt" });

  await make("recipe_categories", { name: "Dinners", tags: ["dinner"], position: 1 });
  await make("recipe_categories", { name: "Baking", tags: ["baking"], position: 2 });
  await make("recipe_ratings", { recipe: recipe.id, user: me.id, stars: 4, favorite: true, approved: true });
  await make("cooked", { date: sandboxDay(-3), recipe: recipe.id });
  await make("meal_plan", { date: sandboxDay(2), note: "Leftovers", meal: "dinner" });
  await make("meal_plan", { date: sandboxDay(4), recipe: recipe.id, meal: "dinner", note: "" });
  await make("shopping_items", { text: "2 cups milk", recipe: recipe.id });
  await make("saved_sites", { name: "Our favourite blog", url: "https://example.com/recipes" });
  // No item may look for its photo online: the pantry would ask Open Food
  // Facts and the store pages for every one, on every pass, and a slow
  // answer would fail the run. "removed" is what stops it (pantryItem.ts).
  for (const item of (await call("GET", "/collections/pantry_items/records?perPage=200")).items) await call("PATCH", `/collections/pantry_items/records/${item.id}`, { photo_link_tried: "removed" });
  // Nutrition only shows for someone who turned it on.
  await call("PATCH", `/collections/users/records/${me.id}`, { show_nutrition: true });
  const login = await sandboxCall(api, "", "POST", "/collections/users/auth-with-password", { identity: username, password: (await import("./sandbox-data.mjs")).PASSWORD });
  return { recipe: recipe.id, login };
}

// Runs in the page. Styles under the old sheets, then the new, on the same
// elements; returns the ones that differ.
async function compareInPage() {
  if (!window.__styles) window.__styles = await Promise.all(["/style-check-old.css", "/style-check-new.css"].map((url) => fetch(url).then((answer) => answer.text())));
  // Mid-way through a fade the numbers would differ by timing alone, so
  // everything is held still; what the animation and transition settings
  // themselves say is read first, before that.
  const still = "\n*,*::before,*::after{transition:none!important;animation:none!important}";
  const MOTION = /^(animation|transition)/;
  const own = [...document.styleSheets];
  for (const sheet of own) sheet.disabled = true;
  const elements = [...document.querySelectorAll("body, body *")];
  const PARTS = ["", "::before", "::after", "::backdrop"];
  // Each element and its drawn parts, as [element, part] in a fixed order.
  const each = (visit) => {
    const out = [];
    for (const element of elements) {
      for (const part of PARTS) {
        if (part === "::backdrop" && element.tagName !== "DIALOG") { out.push(null); continue; }
        const computed = getComputedStyle(element, part || null);
        if ((part === "::before" || part === "::after") && computed.content === "none") { out.push(null); continue; }
        out.push(visit(computed));
      }
    }
    return out;
  };
  const snapshot = (css) => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    void document.body.offsetHeight;
    const motion = each((computed) => {
      const values = {};
      for (let i = 0; i < computed.length; i++) if (MOTION.test(computed[i])) values[computed[i]] = computed.getPropertyValue(computed[i]);
      return values;
    });
    style.textContent = css + still;
    void document.body.offsetHeight;
    const rest = each((computed) => {
      // A border or outline that isn't drawn has a colour all the same;
      // it can differ without anything looking different.
      const noBorder = ["top", "right", "bottom", "left"].every((side) => computed.getPropertyValue(`border-${side}-style`) === "none");
      const noOutline = computed.getPropertyValue("outline-style") === "none";
      const values = {};
      for (let i = 0; i < computed.length; i++) {
        const name = computed[i];
        if (MOTION.test(name)) continue;
        if (noBorder && /^border-.*color$/.test(name)) continue;
        if (noOutline && name === "outline-color") continue;
        // A variable only matters through what uses it, which is compared
        // anyway; the two that code reads are added below.
        if (name.startsWith("--")) continue;
        values[name] = computed.getPropertyValue(name);
      }
      for (const name of ["--photo-radius", "--timer-tray-height"]) values[name] = computed.getPropertyValue(name);
      return values;
    });
    style.remove();
    return rest.map((values, i) => (values ? { ...values, ...motion[i] } : null));
  };
  const before = snapshot(window.__styles[0]);
  const after = snapshot(window.__styles[1]);
  for (const sheet of own) sheet.disabled = false;
  const differences = [];
  for (let i = 0; i < before.length; i++) {
    if (!before[i] && !after[i]) continue;
    const names = new Set([...Object.keys(before[i] ?? {}), ...Object.keys(after[i] ?? {})]);
    const changed = [...names].filter((name) => before[i]?.[name] !== after[i]?.[name]);
    if (!changed.length) continue;
    const element = elements[Math.floor(i / PARTS.length)];
    const classes = (element.getAttribute("class") || "").trim().replace(/\s+/g, ".");
    const parent = (element.parentElement?.getAttribute("class") || "").trim().split(/\s+/)[0];
    differences.push({
      what: `${parent ? `.${parent} > ` : ""}${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}${PARTS[i % PARTS.length]}`,
      changed: changed.slice(0, 5).map((name) => `${name}: ${before[i]?.[name]} -> ${after[i]?.[name]}`),
      more: Math.max(0, changed.length - 5),
    });
  }
  return { elements: elements.length, differences };
}

const ROUTES = (recipe) => ["#/", `#/recipes/${recipe}`, `#/recipes/${recipe}/edit`, "#/add", "#/new", "#/browse", "#/plan", "#/shopping", "#/pantry", "#/profile", "#/settings", "#/household", "#/shelves", "#/backups", "#/export", "#/fridge"];

// What to tap on a screen before looking again: sheets, menus, editors. One
// selector (the first on screen that matches), or a list tapped in order to
// reach something deeper. Only taps that stay inside the app; nothing that
// opens a file picker or types into an editor. Each starts from a fresh load,
// but a choice the app remembers (a layout) stays for the taps after it, so
// a tap that needs a layout names it, not "the other one".
const NOT_CHOSEN = "button:not([aria-pressed='true'])";
const SHOW_AS = ".view-switch[aria-label='Show recipes as'] button";
const DETAILED = ".view-switch[aria-label='Layout'] button:nth-child(2)";
const OPENERS = (recipe) => ({
  "#/": [".tags-button", ".view-options-button", [".view-options-button", `${SHOW_AS}:nth-child(2)`], [".view-options-button", `${SHOW_AS}:nth-child(3)`], ".quick-button", ".favorites-button"],
  [`#/recipes/${recipe}`]: [".pantry-chip", ".pantry-link-button", ".add-to-list", ".section-edit", ".rating-pill", ".thumb-toggle", ".timer-chip", ".title-actions .button", ".hero-button", ".timer-start"],
  [`#/recipes/${recipe}/edit`]: [".help-button"],
  "#/plan": [".plan-add", `.view-switch ${NOT_CHOSEN}`, ".plan-tray > .add-to-list"],
  "#/pantry": [
    ".pantry-name",
    [".pantry-name", ".pantry-card-edit"],
    [".pantry-name", ".pantry-card-edit", ".product-what"],
    [".pantry-name", ".pantry-card-edit", ".date-field"],
    DETAILED,
    [DETAILED, ".stock-label-what"],
    [DETAILED, ".stock-label-what", ".stock-label-editor .date-field"],
    ".place-title > button",
    ".pantry-add-to-list",
  ],
  "#/shopping": [".from-recipe", `.view-switch ${NOT_CHOSEN}`],
  "#/profile": [".swatch"],
  "#/fridge": [".fridge-note .button"],
});

// Looks under a setting of the device's, for the rules that only apply then.
const SPECIAL_LOOKS = (recipe) => [
  { route: `#/recipes/${recipe}`, print: true, name: "printed" },
  { route: "#/fridge", lessMotion: true, name: "with less motion" },
  { route: "#/plan", lessMotion: true, name: "with less motion" },
];

// The pass's server, for Ctrl+C to stop and clear along with the rest.
const running = { server: null };

// One width and theme, on its own fresh server and cleared browser storage,
// so every pass starts from the same household and taps the same things.
async function pass(browser, app, { width, scheme }, results) {
  const view = `${width === 370 ? "small phone" : width === 400 ? "phone" : "desktop"}, ${scheme}`;
  const server = await startTestServer({ port: PORT, prefix: "bentotachi-styles-data-", extraArgs: ["--publicDir", app] });
  running.server = server;
  try {
    const { recipe, login } = await seed();
    const device = ({ print = false, lessMotion = false } = {}) =>
      browser.send("Emulation.setEmulatedMedia", { media: print ? "print" : "", features: [{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: lessMotion ? "reduce" : "no-preference" }] });
    const look = async (where) => {
      const result = await browser.evaluate(`(${compareInPage.toString()})()`);
      results.looks++;
      results.elements += result.elements;
      for (const difference of result.differences) results.found.push({ where: `${where} (${view})`, ...difference });
    };
    // Waits a moment for it: some parts (a pantry row's labels) load after the rest.
    const tap = async (selector) => {
      for (let i = 0; i < 15; i++) {
        if (await browser.evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length); if (!el) return false; el.click(); return true; })()`)) return true;
        await wait(100);
      }
      return false;
    };
    // After a tap: what it fetched has arrived and been drawn. A screen
    // still fetching after 15 seconds is looked at anyway, and said so.
    const settle = async (where) => {
      if (!(await browser.settled(250))) results.restless.push(`${where} (${view})`);
      await wait(150);
    };

    await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 800, deviceScaleFactor: 1, mobile: false });
    await device();
    await browser.open(base, "form, .tabbar");
    await browser.evaluate(`(localStorage.clear(), sessionStorage.clear())`);
    await browser.open(base, "form");
    await look("the login screen");
    await browser.evaluate(`localStorage.setItem("pocketbase_auth", ${JSON.stringify(JSON.stringify({ token: login.token, record: login.record }))})`);

    const openers = OPENERS(recipe);
    for (const route of ROUTES(recipe)) {
      await browser.open(base + route, ".tabbar");
      await look(route);
      // Everything that folds open: menus, drawers, help, pickers.
      const opened = await browser.evaluate(`(() => { let n = 0; for (const b of document.querySelectorAll('button[aria-expanded="false"]')) { if (n >= 14) break; b.click(); n++; } return n; })()`);
      if (opened) {
        await settle(`${route}, everything opened`);
        await look(`${route}, everything opened`);
      }
      for (const opener of openers[route] ?? []) {
        const taps = [opener].flat();
        await browser.open(base + route, ".tabbar");
        let missing = null;
        for (const selector of taps) {
          if (!(await tap(selector))) { missing = selector; break; }
          await settle(`${route}, after tapping ${selector}`);
        }
        if (missing) results.skipped.push({ what: `${route}: ${taps.join(" then ")}${taps.length > 1 ? ` (no ${missing})` : ""}`, view });
        else await look(`${route}, after tapping ${taps.join(" then ")}`);
      }
    }
    for (const special of SPECIAL_LOOKS(recipe)) {
      await browser.open(base + special.route, ".tabbar");
      await device(special);
      await look(`${special.route}, ${special.name}`);
      await device();
    }
    console.log(`${view}: done`);
  } finally {
    await server.stop();
  }
}

// Prints what was found; returns the exit code.
function report(results, passes) {
  console.log(`\nLooked ${results.looks} times (${results.elements} elements in all), old styles against new.`);
  if (results.skipped.length) {
    const byTap = new Map();
    for (const { what, view } of results.skipped) byTap.set(what, [...(byTap.get(what) ?? []), view]);
    console.log(`Some taps found nothing to tap, so what they open wasn't looked at:\n  ${[...byTap].map(([what, views]) => `${what} (${views.length === passes ? "every pass" : views.join("; ")})`).join("\n  ")}`);
  }
  if (results.restless.length) console.log(`These were still loading after 15 seconds, so they may have been looked at half-drawn:\n  ${results.restless.join("\n  ")}`);
  if (!results.found.length) {
    // Half-drawn screens can't vouch for "nothing": that isn't a pass.
    console.log(results.restless.length ? "Nothing looked different, but not everything had loaded: run it again." : "Nothing looks different.");
    return results.restless.length ? 2 : 0;
  }
  // The same element with the same change, once, with where it was seen.
  const grouped = new Map();
  for (const difference of results.found) {
    const key = `${difference.what}|${difference.changed.join("|")}`;
    if (!grouped.has(key)) grouped.set(key, { ...difference, places: [] });
    const places = grouped.get(key).places;
    if (!places.includes(difference.where)) places.push(difference.where);
  }
  console.log(`\n${results.found.length} differences (${grouped.size} distinct):`);
  for (const difference of [...grouped.values()].slice(0, 60)) {
    console.log(`\n  ${difference.what}\n    ${difference.changed.join("\n    ")}${difference.more ? `\n    and ${difference.more} more` : ""}\n    seen on: ${difference.places.slice(0, 3).join("; ")}${difference.places.length > 3 ? `; and ${difference.places.length - 3} more` : ""}`);
  }
  if (grouped.size > 60) console.log(`\n  ...and ${grouped.size - 60} more.`);
  return 1;
}

async function main() {
  const { from, quick } = options();
  refuseStrayStylesheets();
  const before = styles(from);
  const after = styles(null);
  if (before === after) {
    console.log(`The stylesheets are the same as at ${from}: nothing to check.`);
    return 0;
  }
  const folder = mkdtempSync(join(tmpdir(), "bentotachi-styles-"));
  let browser = null;
  const tidy = async () => {
    await browser?.close();
    await running.server?.stop();
    try {
      rmSync(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      console.error(`Couldn't delete the check's temporary folder (${folder}); Windows clears it in time.`);
    }
  };
  // Ctrl+C: the browser, the server and both temporary folders go too.
  for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => void tidy().then(() => process.exit(130)));
  try {
    const app = build(folder, before, after);
    browser = await openBrowser(join(folder, "browser"));
    const results = { looks: 0, elements: 0, found: keyframeDifferences(before, after), skipped: [], restless: [] };
    // 400: most phones (the household's are 393 to 412 wide), where the
    // 520 px rules apply but the 380 px one doesn't.
    const passes = (quick ? [370] : [370, 400, 1200]).flatMap((width) => (quick ? ["light"] : ["light", "dark"]).map((scheme) => ({ width, scheme })));
    for (const each of passes) await pass(browser, app, each, results);
    return report(results, passes.length);
  } finally {
    await tidy();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err.message);
    process.exit(2);
  }
);

// Checks the pantry migrations on data from before them, the way the Pi and
// phones meet them: a database made with only the older migrations, then
// started with all of them and the hooks. Starts its own throwaway servers
// (port BENTO_TEST_PORT + 1, else 8092) in a temporary folder, deleted
// afterwards; never the real data.
//   node test/upgrade.check.mjs
// Every line should say PASS.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXE = join(SERVER, "pocketbase.exe");
const FIRST_NEW = "1765152000";
const PORT = Number(process.env.BENTO_TEST_PORT || 8091) + 1;
const B = `http://127.0.0.1:${PORT}/api`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

let token = "";
async function api(method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function answers() {
  try {
    return (await fetch(`${B}/health`)).ok;
  } catch {
    // Nothing there (yet).
    return false;
  }
}

// A server on the test folder's data, with these migrations and hooks;
// stopped by the returned function.
async function serve(data, migrations, hooks) {
  const where = ["--dir", data, "--migrationsDir", migrations, "--hooksDir", hooks];
  execFileSync(EXE, ["superuser", "upsert", "test@example.com", "testpassword123", ...where], { stdio: "ignore" });
  const server = spawn(EXE, ["serve", "--http", `127.0.0.1:${PORT}`, "--automigrate=false", ...where], { stdio: "ignore" });
  const stopped = new Promise((resolve) => server.on("exit", resolve));
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await wait(250);
    up = await answers();
  }
  if (!up) {
    server.kill();
    throw new Error(`The test server on port ${PORT} didn't start.`);
  }
  token = (await api("POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
  return async () => {
    server.kill();
    await Promise.race([stopped, wait(5000)]);
  };
}

if (await answers()) throw new Error(`Something is already running on port ${PORT}; close it and try again.`);
const folder = mkdtempSync(join(tmpdir(), "bentotachi-upgrade-"));
try {
  const data = join(folder, "data");
  const older = join(folder, "older_migrations");
  const noHooks = join(folder, "no_hooks");
  mkdirSync(older);
  mkdirSync(noHooks);
  for (const file of readdirSync(join(SERVER, "pb_migrations"))) {
    if (file.endsWith(".js") && file < FIRST_NEW) copyFileSync(join(SERVER, "pb_migrations", file), join(older, file));
  }

  const NUT = "3017620422003";
  const COLES = "https://www.coles.com.au/product/jam";
  const WOOLIES = "https://www.woolworths.com.au/shop/productdetails/1/jam";

  // Before: what the older server kept (its hooks set usual_packet from the
  // first one counted, written here directly).
  let stop = await serve(data, older, noHooks);
  try {
    const jam = await api("POST", "/collections/pantry_items/records", {
      name: "Jam",
      status: "have",
      expires: "2026-12-20 00:00:00.000Z",
      opened: true,
      brand: "Bonne Maman",
      usual_packet: { brand: "", size: "370 g" },
      barcodes: [NUT],
      barcode_details: { [NUT]: { brand: "Bonne Maman", size: "370 g" } },
      store_url: COLES,
      more_store_urls: [WOOLIES],
    });
    await api("POST", "/collections/pantry_packets/records", { item: jam.id, size: "370 g", barcode: NUT });
    await wait(20);
    await api("POST", "/collections/pantry_packets/records", { item: jam.id, size: "370 g" });
    const pasta = await api("POST", "/collections/pantry_items/records", {
      name: "Pasta",
      status: "have",
      brand: "Barilla, San Remo",
      usual_packet: { brand: "Barilla", size: "500 g" },
    });
    await api("POST", "/collections/pantry_packets/records", { item: pasta.id, brand: "Barilla", size: "500 g" });
    await api("POST", "/collections/pantry_packets/records", { item: pasta.id, brand: "San Remo", size: "1 kg" });
    await api("POST", "/collections/pantry_items/records", { name: "Milk", status: "have", expires: "2026-11-15 00:00:00.000Z" });
    // Made from a scan by an older app: its brand and barcode, nothing
    // saying the barcode is that brand's.
    await api("POST", "/collections/pantry_items/records", { name: "Ketchup", status: "have", brand: "Heinz", barcodes: ["9300000000028"] });
    const beans = await api("POST", "/collections/pantry_items/records", {
      name: "Beans",
      status: "have",
      brand: "Heinz",
      usual_packet: { brand: "Edgell", size: "" },
      barcodes: ["9300000000035"],
    });
    await api("POST", "/collections/pantry_packets/records", { item: beans.id, brand: "Edgell" });
  } finally {
    await stop();
  }

  // After: everything, as a deploy starts it.
  stop = await serve(data, join(SERVER, "pb_migrations"), join(SERVER, "pb_hooks"));
  try {
    const items = (await api("GET", "/collections/pantry_items/records?perPage=50")).items;
    const named = (name) => items.find((i) => i.name === name);
    const labelsOf = async (item) => (await api("GET", `/collections/pantry_packets/records?perPage=50&sort=created&filter=${encodeURIComponent(`item = "${item.id}"`)}`)).items;
    const kinds = (item) => (item.products ?? []).map((p) => `${p.brand}|${p.size}`);

    const jam = named("Jam");
    const jamLabels = await labelsOf(jam);
    check(
      "a brandless favourite and labels become one product with the favourite brand, keeping its barcode and links",
      JSON.stringify(kinds(jam)) === JSON.stringify(["Bonne Maman|370 g"]) &&
        JSON.stringify(jam.products[0].barcodes) === JSON.stringify([NUT]) &&
        JSON.stringify(jam.products[0].links) === JSON.stringify([COLES, WOOLIES]),
      JSON.stringify(jam.products)
    );
    check(
      "its favourite, barcodes and store links are kept",
      jam.usual_packet?.brand === "Bonne Maman" &&
        jam.usual_packet?.size === "370 g" &&
        JSON.stringify(jam.barcodes) === JSON.stringify([NUT]) &&
        jam.store_url === COLES &&
        JSON.stringify(jam.more_store_urls) === JSON.stringify([WOOLIES]),
      JSON.stringify({ usual: jam.usual_packet, barcodes: jam.barcodes, store_url: jam.store_url, more: jam.more_store_urls })
    );
    check(
      "its date and opened move to its oldest label, and it keeps the date",
      jamLabels[0]?.expires?.startsWith("2026-12-20") && !!jamLabels[0]?.opened && !jamLabels[1]?.expires && !jamLabels[1]?.opened && jam.expires.startsWith("2026-12-20") && jam.dates_used === true,
      JSON.stringify({ labels: jamLabels.map((l) => [l.brand, l.expires, l.opened]), expires: jam.expires, dates_used: jam.dates_used })
    );
    check("its labels get the favourite brand", jamLabels.every((l) => l.brand === "Bonne Maman"), JSON.stringify(jamLabels.map((l) => l.brand)));

    const pasta = named("Pasta");
    check(
      "a list of brands with sized labels gives no brand-only products beside them",
      JSON.stringify(kinds(pasta).sort()) === JSON.stringify(["Barilla|500 g", "San Remo|1 kg"]) && pasta.dates_used === false,
      JSON.stringify(pasta.products)
    );

    const ketchup = named("Ketchup");
    check(
      "a barcode on an item that only knew one brand goes on that brand's product, not a product of its own",
      JSON.stringify(kinds(ketchup)) === JSON.stringify(["Heinz|"]) && JSON.stringify(ketchup.products[0].barcodes) === JSON.stringify(["9300000000028"]),
      JSON.stringify(ketchup.products)
    );
    const beans = named("Beans");
    check(
      "...and with two brands it could be either, so it's left unnamed",
      beans.products.some((p) => !p.brand && !p.size && p.barcodes.includes("9300000000035")),
      JSON.stringify(beans.products)
    );

    const milk = named("Milk");
    check(
      "an item nobody counts keeps its own date",
      milk.expires.startsWith("2026-11-15") && milk.dates_used === true && kinds(milk).length === 0,
      JSON.stringify({ expires: milk.expires, products: milk.products })
    );
  } finally {
    await stop();
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}

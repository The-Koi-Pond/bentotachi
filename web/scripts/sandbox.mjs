// npm run sandbox: Bentotachi to try things in, with nothing real in it. A
// throwaway PocketBase (this repository's hooks and migrations, its data in
// a temporary folder) filled with the made-up household in sandbox-data.mjs,
// and the app from web/src on Vite, live-reloading as code changes.
// Ctrl+C stops both and deletes the data. Never touches server/pb_data.
//   npm run sandbox                  the made-up household
//   npm run sandbox -- --empty       a brand-new server (first-account screen)
//   npm run sandbox -- --port 8280   PocketBase there, the app one above it
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { addDays, localToday, toStoredDate } from "../src/dates.ts";
import { MEMBERS, NOTES, PANTRY, PASSWORD, PLAN, RECIPES, SHOPPING } from "./sandbox-data.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(web, "..", "server");
const args = process.argv.slice(2);
const empty = args.includes("--empty");
const portAt = args.indexOf("--port");
const port = portAt >= 0 ? Number(args[portAt + 1]) : 8180;
const appPort = port + 1;
const exe = join(server, process.platform === "win32" ? "pocketbase.exe" : "pocketbase");

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1024 || port > 65000) fail("--port needs a number like 8280.");
if (!existsSync(exe)) fail(`PocketBase isn't downloaded yet: ${exe}. README.md, "First-time setup", says how.`);

// Another sandbox, a test server or someone's dev server may be there.
function portFree(at) {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once("error", () => resolve(false));
    probe.listen(at, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}
for (const at of [port, appPort]) {
  if (!(await portFree(at))) fail(`Port ${at} is in use. Pick others with: npm run sandbox -- --port ${port + 100}`);
}

// Data from sandboxes stopped without Ctrl+C (an agent stopping the ports)
// is still there; one that's running holds its files, so it stays.
for (const old of readdirSync(tmpdir()).filter((name) => name.startsWith("bentotachi-sandbox-"))) {
  try {
    rmSync(join(tmpdir(), old), { recursive: true, force: true });
  } catch {
    // In use by a sandbox that's running.
  }
}
const data = mkdtempSync(join(tmpdir(), "bentotachi-sandbox-"));
const where = ["--dir", data, "--migrationsDir", join(server, "pb_migrations"), "--hooksDir", join(server, "pb_hooks")];
// --automigrate=false: without it, a collection changed on the admin page
// would write a migration into the repository's pb_migrations.
const pocketbase = spawn(exe, ["serve", "--http", `127.0.0.1:${port}`, "--automigrate=false", ...where], { stdio: "ignore" });
let vite = null;
let stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await vite?.close().catch(() => {});
  pocketbase.kill();
  // Windows holds the database files a moment after PocketBase stops.
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    rmSync(data, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    console.error(`Couldn't delete the sandbox's data (${data}); it's in the temporary folder, so Windows clears it in time.`);
  }
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => void stop());
// Killed some other way: PocketBase mustn't outlive this.
process.on("exit", () => pocketbase.kill());

const api = `http://127.0.0.1:${port}/api`;
async function call(token, method, path, body) {
  const answer = await fetch(api + path, {
    method,
    headers: { "content-type": "application/json", ...(token && { authorization: token }) },
    body: body && JSON.stringify(body),
  });
  const text = await answer.text();
  if (!answer.ok) throw new Error(`${method} ${path}: ${answer.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function waitForServer() {
  for (let i = 0; i < 75; i++) {
    try {
      if ((await fetch(`${api}/health`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("PocketBase didn't start within 15 seconds.");
}

const day = (offset) => toStoredDate(addDays(localToday(), offset));

// The household as the app would make it: the first member through the
// first-account route, the second by the first, then the rest as them.
async function fill() {
  const [first, ...others] = MEMBERS;
  await call("", "POST", "/cookbook/setup", { username: first.username, name: first.name, password: PASSWORD });
  const tokens = {};
  const ids = {};
  const logIn = async (username) => {
    const auth = await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: PASSWORD });
    tokens[username] = auth.token;
    ids[username] = auth.record.id;
  };
  await logIn(first.username);
  const token = tokens[first.username];
  for (const member of others) {
    await call(token, "POST", "/collections/users/records", { ...member, password: PASSWORD, passwordConfirm: PASSWORD });
    await logIn(member.username);
  }

  await call(token, "POST", "/collections/household_settings/records", { country: "AU" });
  const recipeIds = {};
  for (const recipe of RECIPES) recipeIds[recipe.title] = (await call(token, "POST", "/collections/recipes/records", recipe)).id;
  for (const [name, location, subcategory, status, useBy] of PANTRY) {
    await call(token, "POST", "/collections/pantry_items/records", { name, location, subcategory, status, expires: useBy === null ? "" : day(useBy) });
  }
  for (const [text, checked] of SHOPPING) await call(token, "POST", "/collections/shopping_items/records", { text, checked });
  for (const [offset, meal, title] of PLAN) {
    await call(token, "POST", "/collections/meal_plan/records", { date: day(offset), meal, recipe: recipeIds[title], note: "" });
    // What was planned before today was cooked.
    if (offset < 0) await call(token, "POST", "/collections/cooked/records", { date: day(offset), recipe: recipeIds[title] });
  }
  for (const [username, text] of NOTES) await call(tokens[username], "POST", "/collections/notes/records", { text });
}

try {
  await waitForServer();
  if (!empty) await fill();
  vite = await createServer({
    root: web,
    // Its own cache folder, so it can run beside `npm run dev`.
    cacheDir: join(web, "node_modules", ".vite-sandbox"),
    server: {
      host: "127.0.0.1",
      port: appPort,
      strictPort: true,
      proxy: { "/api": `http://127.0.0.1:${port}`, "/_": `http://127.0.0.1:${port}` },
    },
  });
  await vite.listen();
} catch (err) {
  console.error(`\nThe sandbox didn't start: ${err instanceof Error ? err.message : err}`);
  await stop(1);
}

const logins = MEMBERS.map((member) => member.username).join(" or ");
console.log(`
Bentotachi sandbox: http://127.0.0.1:${appPort}
${empty ? "A brand-new server: the app opens on the first-account screen." : `Log in as ${logins}; the password is PASSWORD in web/scripts/sandbox-data.mjs.`}
The server's admin page: http://127.0.0.1:${port}/_/ (${empty ? "made with the first account" : `${MEMBERS[0].username}@bento.local, same password`})
Ctrl+C stops it and deletes its data. Stopped another way: stop the processes on ports ${port} and ${appPort}
(this one is ${process.pid}, PocketBase ${pocketbase.pid}).`);

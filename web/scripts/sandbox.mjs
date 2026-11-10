// npm run sandbox: Bentotachi to try things in, with nothing real in it. A
// throwaway PocketBase (this repository's hooks and migrations, its data in
// a temporary folder) filled with the made-up household in sandbox-data.mjs,
// and the app from web/src on Vite, live-reloading as code changes.
// Ctrl+C stops both and deletes the data. Never touches server/pb_data.
//   npm run sandbox                  the made-up household
//   npm run sandbox -- --empty       a brand-new server (first-account screen)
//   npm run sandbox -- --port 8280   PocketBase there, the app one above it
import { readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { MEMBERS } from "./sandbox-data.mjs";
import { fillSandbox } from "./sandbox-fill.mjs";
import { portFree, startTestServer } from "./testServer.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const empty = args.includes("--empty");
const portAt = args.indexOf("--port");
const port = portAt >= 0 ? Number(args[portAt + 1]) : 8180;
const appPort = port + 1;

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1024 || port > 65000) fail("--port needs a number like 8280.");

// Another sandbox, a test server or someone's dev server may be there.
for (const at of [port, appPort]) {
  if (!(await portFree(at))) fail(`Port ${at} is in use. Pick others with: npm run sandbox -- --port ${port + 100}`);
}

// Data from sandboxes stopped without Ctrl+C (an agent stopping the ports)
// is still there; one that's running holds its files, so it stays.
const PREFIX = "bentotachi-sandbox-";
for (const old of readdirSync(tmpdir()).filter((name) => name.startsWith(PREFIX))) {
  try {
    rmSync(join(tmpdir(), old), { recursive: true, force: true });
  } catch {
    // In use by a sandbox that's running.
  }
}

let pocketbase = null;
let vite = null;
let stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await vite?.close().catch(() => {
    // Vite already down: PocketBase and the data still need clearing.
  });
  await pocketbase?.stop();
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => void stop());

try {
  pocketbase = await startTestServer({ port, prefix: PREFIX });
  if (!empty) await fillSandbox(`${pocketbase.url}/api`);
  vite = await createServer({
    root: web,
    // Its own cache folder, so it can run beside `npm run dev`.
    cacheDir: join(web, "node_modules", ".vite-sandbox"),
    server: {
      host: "127.0.0.1",
      port: appPort,
      strictPort: true,
      proxy: { "/api": pocketbase.url, "/_": pocketbase.url },
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

// A throwaway PocketBase: this repository's migrations and hooks, its data
// in a new temporary folder, never server/pb_data. Shared by the tests, the
// sandbox and the style check, so all three start and stop one the same way.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const server = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "server");
export const pocketbaseExe = join(server, process.platform === "win32" ? "pocketbase.exe" : "pocketbase");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Whether nothing at all is listening there, PocketBase or not. Asked both
// ways: Windows lets a server on every address (0.0.0.0) and one on
// 127.0.0.1 share a port, so either alone can look free.
export async function portFree(port) {
  const canListen = (host) =>
    new Promise((resolve) => {
      const probe = createServer();
      probe.once("error", () => resolve(false));
      probe.listen({ port, host, exclusive: true }, () => probe.close(() => resolve(true)));
    });
  return (await canListen("127.0.0.1")) && (await canListen("0.0.0.0")) && !(await answers(port));
}

// Something there answers web requests (a server Windows let share the port).
function answers(port) {
  return fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) }).then(() => true, (err) => err.name === "TimeoutError");
}

// Starts one on `port` and waits until it answers. `prefix` names its
// temporary folder; `hooksDir(folder)` gives other hooks than the
// repository's; `beforeServe(exe, where)` runs before it starts (making an
// admin account). Returns its folder, its address, and stop(), which ends it
// and deletes the folder and never throws, so it's safe in a `finally`.
export async function startTestServer({ port, prefix, hooksDir, extraArgs = [], beforeServe }) {
  if (!existsSync(pocketbaseExe)) throw new Error(`PocketBase isn't downloaded yet: ${pocketbaseExe}. README.md, "First-time setup", says how.`);
  if (!(await portFree(port))) throw new Error(`Port ${port} is in use: close what's on it, or pick another port.`);

  const folder = mkdtempSync(join(tmpdir(), prefix));
  let pocketbase = null;
  let exited = false;
  let stopping = null;
  const stop = () => {
    stopping ??= (async () => {
      if (pocketbase && !exited) {
        const gone = new Promise((resolve) => pocketbase.once("exit", resolve));
        pocketbase.kill();
        await Promise.race([gone, wait(5000)]);
      }
      try {
        // Windows may hold the database files a moment after the server stops.
        rmSync(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      } catch {
        console.error(`Couldn't delete the test server's data (${folder}); it's in the temporary folder, so Windows clears it in time.`);
      }
    })();
    return stopping;
  };

  try {
    const where = ["--dir", join(folder, "data"), "--migrationsDir", join(server, "pb_migrations"), "--hooksDir", hooksDir ? hooksDir(folder) : join(server, "pb_hooks")];
    beforeServe?.(pocketbaseExe, where);
    // --automigrate=false: without it, a collection changed on this server
    // would write a migration into the repository's pb_migrations.
    pocketbase = spawn(pocketbaseExe, ["serve", "--http", `127.0.0.1:${port}`, "--automigrate=false", ...where, ...extraArgs], { stdio: "ignore" });
    pocketbase.once("exit", () => (exited = true));
    // Killed some other way than stop(): PocketBase mustn't outlive this.
    process.once("exit", () => pocketbase.kill());

    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 150; i++) {
      if (exited) throw new Error("The test server stopped as it started (a migration or hook it couldn't load?).");
      if (await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) }).then((answer) => answer.ok, () => false)) return { folder, url, pid: pocketbase.pid, stop };
      await wait(200);
    }
    throw new Error("The test server didn't start within 30 seconds.");
  } catch (err) {
    await stop();
    throw err;
  }
}

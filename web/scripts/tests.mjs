// Everything that must pass before a release or deploy (release.mjs and
// deploy.mjs call runTests and stop if it fails):
//   1. Both unit test suites (the server's, then the web app's). A suite
//      that finds no tests at all counts as failing (node --test passes when
//      its pattern matches nothing).
//   2. The date tests again in two far-off time zones, since dates must
//      never shift by a day wherever the phone is.
//   3. The end-to-end checks (server/test/*.check.mjs) against a throwaway
//      PocketBase in a temporary folder, started with --automigrate=false
//      so it can't write migration files into the project, then stopped and
//      deleted. Never the real data.

import { execFileSync, execSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(web, "..");
const server = join(root, "server");
// Out of the way of a test server someone may have open on 8091. A reviewer
// given its own port runs `npm test` with BENTO_CHECK_PORT set to it.
const CHECK_PORT = Number(process.env.BENTO_CHECK_PORT) || 8099;

class TestsFailed extends Error {}

// Runs node --test, returning how many tests passed; throws if any failed or
// none were found.
function nodeTests(label, cwd, patterns, env = {}) {
  const again = `node --test ${patterns.map((p) => `"${p}"`).join(" ")} (in ${cwd})`;
  let output;
  try {
    output = execSync(`node --test ${patterns.map((p) => `"${p}"`).join(" ")}`, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
  } catch (err) {
    console.error(String(err.stdout ?? "").split("\n").filter((line) => /^✖|^ℹ (tests|pass|fail)/.test(line)).join("\n"));
    throw new TestsFailed(`The ${label} failed. See them with: ${again}`);
  }
  const count = Number(output.match(/^ℹ tests (\d+)/m)?.[1] ?? 0);
  if (!count) throw new TestsFailed(`The ${label} found nothing to run. Check: ${again}`);
  console.log(`${label}: ${count} passed`);
  return count;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function answers(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function serverChecks() {
  const exe = join(server, "pocketbase.exe");
  if (!existsSync(exe)) throw new TestsFailed(`No ${exe}, so the end-to-end checks can't run (see README: First-time setup).`);
  const health = `http://127.0.0.1:${CHECK_PORT}/api/health`;
  if (await answers(health)) throw new TestsFailed(`Something is already running on port ${CHECK_PORT}; close it and try again.`);

  const folder = mkdtempSync(join(tmpdir(), "bentotachi-checks-"));
  const where = ["--dir", join(folder, "pb_data"), "--migrationsDir", join(server, "pb_migrations"), "--hooksDir", join(server, "pb_hooks")];
  execFileSync(exe, ["superuser", "upsert", "test@example.com", "testpassword123", ...where], { stdio: "ignore" });
  const pocketbase = spawn(exe, ["serve", "--http", `127.0.0.1:${CHECK_PORT}`, "--automigrate=false", ...where], { stdio: "ignore" });
  const stopped = new Promise((resolve) => pocketbase.on("exit", resolve));
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      up = await answers(health);
      if (!up) await wait(500);
    }
    if (!up) throw new TestsFailed("The test server didn't start, so the end-to-end checks couldn't run.");

    // pantry-rules first: it makes fixed accounts on a fresh server.
    const checks = readdirSync(join(server, "test"))
      .filter((file) => file.endsWith(".check.mjs"))
      .sort((a, b) => (a.startsWith("pantry-rules") ? -1 : b.startsWith("pantry-rules") ? 1 : a.localeCompare(b)));
    let passed = 0;
    for (const check of checks) {
      let output = "";
      let failed = false;
      try {
        output = execFileSync(process.execPath, [join("test", check)], {
          cwd: server,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, BENTO_TEST_PORT: String(CHECK_PORT) },
        });
      } catch (err) {
        output = String(err.stdout ?? "") + String(err.stderr ?? "");
        failed = true;
      }
      const lines = output.split("\n");
      const passes = lines.filter((line) => line.startsWith("PASS")).length;
      const fails = lines.filter((line) => line.startsWith("FAIL"));
      if (failed || fails.length || !passes) {
        console.error(fails.length ? fails.join("\n") : output.split("\n").slice(-8).join("\n"));
        throw new TestsFailed(`The end-to-end check ${check} failed. See it with: node test/${check} (in ${server}, against a test server; see the top of pantry-rules.check.mjs)`);
      }
      passed += passes;
    }
    console.log(`end-to-end checks: ${passed} passed (${checks.length} files)`);
  } finally {
    pocketbase.kill();
    await Promise.race([stopped, wait(5000)]);
    // Windows may hold the database files a moment after the server stops.
    for (let i = 0; i < 10; i++) {
      try {
        rmSync(folder, { recursive: true, force: true });
        break;
      } catch {
        await wait(300);
      }
    }
  }
}

export async function runTests() {
  try {
    nodeTests("server tests", root, ["server/test/*.test.js"]);
    nodeTests("web tests", web, ["test/*.test.ts"]);
    for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"])
      nodeTests(`date tests in ${zone}`, web, ["test/dates.test.ts", "test/expiry.test.ts"], { TZ: zone });
    await serverChecks();
  } catch (err) {
    if (!(err instanceof TestsFailed)) throw err;
    console.error(`\n${err.message}\nNothing was built or sent.`);
    process.exit(1);
  }
}

// Everything that must pass before a release or deploy (release.mjs and
// deploy.mjs call runTests and stop if it fails):
//   1. Both unit test suites (the server's, then the web app's). A suite
//      that finds no tests at all counts as failing (node --test passes when
//      its pattern matches nothing).
//   2. The date tests again in two far-off time zones, since dates must
//      never shift by a day wherever the phone is. And knip, for code
//      nothing uses, and oxlint, for React's rules for hooks.
//   3. A throwaway PocketBase in a temporary folder, started with
//      --automigrate=false so it can't write migration files into the
//      project, then stopped and deleted. Never the real data. On it:
//      the server's unit tests again, inside PocketBase's own JavaScript
//      engine (engineHooks), then the end-to-end checks
//      (server/test/*.check.mjs).

import { execFileSync, execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startTestServer } from "./testServer.mjs";

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

// The hooks for the throwaway server: a copy of pb_hooks, plus the server's
// unit tests and a test-only route that runs them inside PocketBase's own
// JavaScript engine. Node passes code that engine doesn't (a regex Node
// copes with failed there on a long page), and the hooks only ever run
// there. The tests' requires are pointed at stand-ins for node:test and
// node:assert (server/test/engine/) and at the copied hooks. Nothing is
// added to pb_hooks itself, so the route never reaches the Pi or a phone.
const slash = (path) => path.replaceAll("\\", "/");
const ENGINE_ROUTE = "/api/engine-tests";

function engineHooks(folder) {
  const hooks = join(folder, "pb_hooks");
  cpSync(join(server, "pb_hooks"), hooks, { recursive: true });
  const tests = join(folder, "engine-tests");
  mkdirSync(tests);
  const engine = join(server, "test", "engine");
  const at = (path) => `require(${JSON.stringify(slash(path))})`;
  const files = readdirSync(join(server, "test"))
    .filter((file) => file.endsWith(".test.js"))
    .sort();
  for (const file of files) {
    const source = readFileSync(join(server, "test", file), "utf8")
      .replaceAll('require("node:test")', at(join(engine, "node-test.js")))
      .replaceAll('require("node:assert/strict")', at(join(engine, "assert.js")))
      .replace(/require\("\.\.\/pb_hooks\/([^"]+)"\)/g, (_, name) => at(join(hooks, name)));
    writeFileSync(join(tests, file), source);
  }
  const run = `${at(join(engine, "run.js"))}.run(${JSON.stringify(files.map((file) => slash(join(tests, file))))}, ${JSON.stringify(slash(join(engine, "node-test.js")))})`;
  writeFileSync(join(hooks, "engine_tests.pb.js"), `routerAdd("GET", "${ENGINE_ROUTE}", (e) => e.json(200, ${run}));\n`);
  return hooks;
}

async function engineTests(base) {
  let results;
  try {
    const answer = await fetch(base + ENGINE_ROUTE);
    results = await answer.json();
    if (!Array.isArray(results)) throw new Error(JSON.stringify(results).slice(0, 300));
  } catch (err) {
    throw new TestsFailed(`The server tests couldn't run inside PocketBase: ${err.message}`);
  }
  const failures = results.filter((result) => !result.ok);
  if (failures.length) {
    for (const failure of failures) console.error(`✖ ${failure.file}: ${failure.name}\n  ${failure.error.replaceAll("\n", "\n  ")}`);
    throw new TestsFailed(
      `${failures.length} server test(s) failed inside PocketBase's own JavaScript engine though Node may pass them: the hooks run in that engine. (Run with npm test; the route is ${ENGINE_ROUTE} on the throwaway server.)`
    );
  }
  const ran = results.filter((result) => !result.skipped).length;
  if (!ran) throw new TestsFailed("The server tests found nothing to run inside PocketBase.");
  console.log(`server tests in PocketBase's engine: ${ran} passed`);
}

async function serverChecks() {
  let pocketbase;
  try {
    pocketbase = await startTestServer({
      port: CHECK_PORT,
      prefix: "bentotachi-checks-",
      hooksDir: engineHooks,
      beforeServe: (exe, where) => execFileSync(exe, ["superuser", "upsert", "test@example.com", "testpassword123", ...where], { stdio: "ignore" }),
    });
  } catch (err) {
    throw new TestsFailed(`${err.message} So the end-to-end checks couldn't run (they use port ${CHECK_PORT}; BENTO_CHECK_PORT picks another).`);
  }
  try {
    await engineTests(pocketbase.url);

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
    await pocketbase.stop();
  }
}

// Code nothing uses (files, exports, packages) in web/, by knip (knip.json):
// left behind, it's more to read and keep right for nothing.
function unusedCode() {
  try {
    execSync("npx knip --no-progress", { cwd: web, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    console.error(String(err.stdout ?? "") + String(err.stderr ?? ""));
    throw new TestsFailed("knip found code nothing uses (above). Remove it, or drop the export if only its own file uses it. See it with: npm run knip (in web)");
  }
  console.log("unused code (knip): none");
}

// React's rules for hooks, by oxlint (.oxlintrc.json): a hook called
// conditionally, or an effect that reads something it doesn't list and so
// runs with an old value of it. oxlint rather than ESLint: typescript-eslint
// doesn't read TypeScript 7 yet. The rule names and eslint-disable comments
// are ESLint's.
function hookRules() {
  try {
    execSync("npx oxlint src", { cwd: web, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    console.error(String(err.stdout ?? "") + String(err.stderr ?? ""));
    throw new TestsFailed("oxlint found code breaking React's rules for hooks (above). See it with: npm run lint (in web)");
  }
  console.log("React hook rules (oxlint): kept");
}

export async function runTests() {
  try {
    nodeTests("server tests", root, ["server/test/*.test.js"]);
    nodeTests("web tests", web, ["test/*.test.ts"]);
    unusedCode();
    hookRules();
    for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"])
      nodeTests(`date tests in ${zone}`, web, ["test/dates.test.ts", "test/expiry.test.ts", "test/pantryPackets.test.ts"], { TZ: zone });
    await serverChecks();
  } catch (err) {
    if (!(err instanceof TestsFailed)) throw err;
    console.error(`\n${err.message}\nNothing was built or sent.`);
    process.exit(1);
  }
}

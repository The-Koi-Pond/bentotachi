// Runs both test suites (the server's, then the web app's) and stops the
// calling script if any test fails, or if a suite finds no tests at all
// (node --test passes when its pattern matches nothing), so a release or
// deploy never goes out untested. Used by release.mjs and deploy.mjs.

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(web, "..");

export function runTests() {
  for (const [label, cwd, pattern] of [
    ["server", root, "server/test/*.test.js"],
    ["web", web, "test/*.test.ts"],
  ]) {
    const again = `node --test "${pattern}" (in ${cwd})`;
    let output;
    try {
      output = execSync(`node --test "${pattern}"`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      console.error(String(err.stdout ?? "").split("\n").filter((line) => /^✖|^ℹ (tests|pass|fail)/.test(line)).join("\n"));
      console.error(`\nThe ${label} tests failed, so nothing was built or sent. See them with: ${again}`);
      process.exit(1);
    }
    const count = Number(output.match(/^ℹ tests (\d+)/m)?.[1] ?? 0);
    if (!count) {
      console.error(`\nThe ${label} tests found nothing to run, so nothing was built or sent. Check: ${again}`);
      process.exit(1);
    }
    console.log(`${label} tests: ${count} passed`);
  }
}

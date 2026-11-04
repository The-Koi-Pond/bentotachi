// Runs a one-off script against the Pi's Bentotachi as a temporary admin,
// for fixing data the app itself can't (like tidying the pantry's names
// and merging duplicates, 2026-11-05):
//
//   npm run pi-admin -- <path to script.mjs> [the script's own arguments]
//
// (A full path, or one from the web folder: npm runs this from there.)
//
// Steps:
//   1. adds a temporary admin login on the Pi, with a random password;
//   2. makes a backup there first (before_<script name>_<date and time>.zip
//      in the Pi's pb_data/backups; npm run backup copies it to this PC);
//   3. runs the script, which finds the server and login in BENTO_URL,
//      BENTO_ADMIN_EMAIL and BENTO_ADMIN_PASSWORD;
//   4. removes the temporary admin again, even if something failed.
//
// Try the script on a throwaway copy of a backup first (a PocketBase with
// --dir on the unzipped backup, --automigrate=false), and give it a dry-run
// mode. Xel runs this one: Claude's permissions don't allow adding logins on
// the Pi. The Pi's details come from web/scripts/pi.json (see piConfig.mjs).

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { piConfig } from "./piConfig.mjs";

const [script, ...scriptArgs] = process.argv.slice(2);
if (!script || !existsSync(script)) {
  console.error(
    script ? `No script at ${resolve(script)}. Nothing was changed.` : "Which script? npm run pi-admin -- <path to script.mjs>",
  );
  process.exit(1);
}

const { ssh, key, url } = piConfig();
const api = `${url.replace(/\/$/, "")}/api`;
const sshExe = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "OpenSSH", "ssh.exe");
const onPi = (command) =>
  execFileSync(sshExe, ["-i", key, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", ssh, command], { encoding: "utf8" }).trim();

const email = "pi-admin-temp@example.invalid";
const password = randomBytes(18).toString("hex");
// PocketBase only takes backup names of lowercase letters, digits, _ and -.
const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const backupName = `before_${basename(script, ".mjs").toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_${stamp}.zip`;

async function backUp() {
  const login = await fetch(`${api}/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!login.ok) throw new Error(`Couldn't log in as the temporary admin (${login.status}).`);
  const { token } = await login.json();
  const made = await fetch(`${api}/backups`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token },
    body: JSON.stringify({ name: backupName }),
  });
  if (!made.ok) throw new Error(`The backup failed (${made.status} ${await made.text()}), so the script wasn't run.`);
}

console.log("1. Adding a temporary admin login on the Pi…");
console.log("   " + onPi(`cd ~/bento/server && ./pocketbase superuser upsert ${email} ${password} --dir pb_data`));
try {
  console.log(`2. Backing up first (${backupName})…`);
  await backUp();
  console.log(`3. Running ${basename(script)}…`);
  execFileSync(process.execPath, [resolve(script), ...scriptArgs], {
    stdio: "inherit",
    env: { ...process.env, BENTO_URL: url, BENTO_ADMIN_EMAIL: email, BENTO_ADMIN_PASSWORD: password },
  });
} catch (err) {
  // The script's own output says what went wrong; this says what happened.
  process.exitCode = 1;
  console.error(`\nStopped: ${err.message}`);
  console.error(`The backup from before (if it was made) is ${backupName} on the Pi.`);
} finally {
  console.log("4. Removing the temporary admin login…");
  console.log("   " + onPi(`cd ~/bento/server && ./pocketbase superuser delete ${email} --dir pb_data`));
}

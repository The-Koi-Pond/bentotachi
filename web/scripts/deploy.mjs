// Sends Bento's latest server code and app to the Raspberry Pi and restarts
// Bento there:
//
//   npm run deploy          (from the web folder; also after npm run release)
//
// Builds the web app, then replaces the Pi's pb_hooks, pb_migrations,
// pb_public and releases with this PC's copies (unpacked into a fresh folder
// first, then swapped in) and restarts the bento service, which applies any
// new database changes. The Pi's data (pb_data) is never touched.
//
// Needs the SSH key made during the move to the Pi, and the Pi's details in
// web/scripts/pi.json (see piConfig.mjs). The Pi's Tailscale address works
// from anywhere.

import { execFileSync, execSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { piConfig } from "./piConfig.mjs";
import { runTests } from "./tests.mjs";

const { ssh: PI, url: PI_URL, key: KEY } = piConfig();
const FOLDERS = ["pb_hooks", "pb_migrations", "pb_public", "releases"];

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(web, "..", "server");
const ssh = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "OpenSSH", "ssh.exe");
const tar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
const sshArgs = ["-i", KEY, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", PI];

function onPi(command) {
  return execFileSync(ssh, [...sshArgs, command], { encoding: "utf8" });
}

runTests();

console.log("> npm run build");
execSync("npm run build", { cwd: web, stdio: "inherit" });

// Every folder must be here, or the Pi would lose its copy: from a fresh
// clone there's no server/releases, and Windows' tar just skips a missing
// folder. releases must hold the app the Pi offers (latest.json).
const missing = FOLDERS.filter((folder) => !existsSync(join(server, folder)) || !readdirSync(join(server, folder)).length);
if (!existsSync(join(server, "releases", "latest.json")) && !missing.includes("releases")) missing.push("releases (no latest.json)");
if (missing.length) {
  console.error(`\nNothing was sent: server/${missing.join(", server/")} is missing or empty here. (For releases: run npm run release first, or copy server/releases from the Pi.)`);
  process.exit(1);
}

// Pack the folders here, unpack them on the Pi into a fresh "incoming"
// folder, and only once all of them have arrived, swap each one in.
const arrived = FOLDERS.map((folder) => `[ -d incoming/${folder} ] && ls -A incoming/${folder} | grep -q .`).join(" && ");
const swap = FOLDERS.map((folder) => `rm -rf ${folder} && mv incoming/${folder} ${folder}`).join(" && ");
const remote =
  `cd ~/bento/server && rm -rf incoming && mkdir incoming && tar -xf - -C incoming && ` +
  `{ ${arrived} || { echo Not everything arrived, so the Pi kept what it had. >&2; rm -rf incoming; exit 3; }; } && ${swap} && rmdir incoming`;
console.log(`\nSending ${FOLDERS.join(", ")} to the Pi…`);
await new Promise((resolve, reject) => {
  const pack = spawn(tar, ["-cf", "-", ...FOLDERS], { cwd: server });
  const send = spawn(ssh, [...sshArgs, remote], { stdio: ["pipe", "inherit", "inherit"] });
  let packed = null;
  pack.stdout.pipe(send.stdin);
  pack.stderr.pipe(process.stderr);
  pack.on("error", reject);
  pack.on("close", (code) => (packed = code));
  send.on("error", reject);
  send.on("close", (code) => {
    if (code !== 0) return reject(new Error(`Copying to the Pi failed (exit ${code}).`));
    // The Pi checked everything arrived, but say so if packing complained.
    if (packed) return reject(new Error(`Packing the folders here failed (tar exit ${packed}); check the Pi.`));
    resolve();
  });
});

console.log("Restarting Bentotachi on the Pi…");
onPi("sudo -n /usr/bin/systemctl restart bento");

// Wait for it to answer again. (No process.exit: on Windows, exiting
// straight after a fetch can crash Node on the way out.)
let running = false;
for (let attempt = 0; attempt < 30 && !running; attempt++) {
  try {
    const response = await fetch(`${PI_URL}/api/health`);
    if (response.ok) {
      running = true;
      const latest = await (await fetch(`${PI_URL}/api/cookbook/app/latest`)).json().catch(() => ({}));
      console.log(`\nBentotachi is running on the Pi again${latest.versionName ? ` (app ${latest.versionName} available)` : ""}.`);
    }
  } catch {
    // Not up yet.
  }
  if (!running) await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!running) {
  console.error("\nBentotachi didn't come back on the Pi within 30 seconds. On the Pi, `journalctl -u bento -n 30` shows why.");
  process.exitCode = 1;
}

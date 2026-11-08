// Copies the Raspberry Pi's nightly Bento backups to this PC, so they
// survive the Pi's SD card failing:
//
//   npm run backup          (from the web folder)
//
// Backups land in backups/pi/ in the project folder (never committed).
// Ones already copied are skipped. Each zip is a whole Bento: recipes,
// photos, lists and accounts. Copy that folder to a USB stick now and then
// too.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { onPi, piConfig, SCP } from "./piConfig.mjs";

// The Pi's details are in web/scripts/pi.json (see piConfig.mjs).
const pi = piConfig();
const REMOTE = "bento/server/pb_data/backups";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = join(root, "backups", "pi");

const listing = onPi(pi, `ls ${REMOTE} 2>/dev/null || true`);
const zips = listing.split("\n").map((name) => name.trim()).filter((name) => name.endsWith(".zip"));
if (!zips.length) {
  console.log("The Pi has no backups yet (the first one is made at 3:30 am).");
  process.exit(0);
}

mkdirSync(target, { recursive: true });
const missing = zips.filter((name) => !existsSync(join(target, name)));
for (const name of missing) {
  console.log(`Copying ${name}…`);
  execFileSync(SCP, [...pi.sshOptions, "-q", `${pi.ssh}:${REMOTE}/${name}`, join(target, name)], { stdio: "inherit" });
}
console.log(`\n${missing.length} new, ${zips.length - missing.length} already here. Backups are in ${target}`);

// Where the household's Bento server (the Raspberry Pi) is, for
// `npm run deploy` and `npm run backup`. Kept in web/scripts/pi.json, which
// is never committed (it's this household's own setup); copy
// pi.example.json to pi.json and fill it in.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "pi.json");

export function piConfig() {
  if (!existsSync(file)) {
    console.error(`No ${file}. Copy pi.example.json next to it to pi.json and fill in your Pi's details.`);
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(file, "utf8"));
  return {
    // "user@address", as SSH takes it.
    ssh: config.ssh,
    // Bento's address on the Pi, like "http://100.64.12.34:8090".
    url: config.url,
    // The SSH key; "~" means your home folder.
    key: config.key.replace(/^~(?=[\\/])/, homedir()),
  };
}

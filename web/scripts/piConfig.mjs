// Where the household's Bento server (the Raspberry Pi) is, for
// `npm run deploy` and `npm run backup`. Kept in web/scripts/pi.json, which
// is never committed (it's this household's own setup); copy
// pi.example.json to pi.json and fill it in.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "pi.json");

// Windows' own OpenSSH, so it works whichever ssh is first on the PATH.
const openssh = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "OpenSSH");
export const SSH = join(openssh, "ssh.exe");
export const SCP = join(openssh, "scp.exe");

export function piConfig() {
  if (!existsSync(file)) {
    console.error(`No ${file}. Copy pi.example.json next to it to pi.json and fill in your Pi's details.`);
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(file, "utf8"));
  // The SSH key; "~" means your home folder.
  const key = config.key.replace(/^~(?=[\\/])/, homedir());
  return {
    // "user@address", as SSH takes it.
    ssh: config.ssh,
    // Bento's address on the Pi, like "http://100.64.12.34:8090".
    url: config.url,
    key,
    // For SSH and SCP: never stop to ask for a password, and give up after
    // 15 seconds if the Pi can't be reached.
    sshOptions: ["-i", key, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15"],
  };
}

// Runs a command on the Pi; what it printed, trimmed.
export function onPi({ ssh, sshOptions }, command) {
  return execFileSync(SSH, [...sshOptions, ssh, command], { encoding: "utf8" }).trim();
}

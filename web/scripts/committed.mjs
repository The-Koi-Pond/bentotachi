// Only committed code leaves this PC: deploy (to the Pi), release and play
// (the apps carry the web app, plus pb_hooks and pb_migrations for
// phone-only mode; see copyBentoServerCode in android/app/build.gradle) and
// package (the friends' zip) all call this first.
//
// Server code: a stray file in pb_migrations (PocketBase writes one when a
// test server's settings are changed with automigrate on), or a migration
// still being written, would otherwise change a real database. On phones and
// friends' servers that can't be undone: PocketBase runs each migration file
// once, so a later fix to it never reaches them.
//
// The web app: the build takes web/ as it is in the folder, so another
// session's half-finished work would go out with it (it nearly did on
// 2026-11-04). web/android and web/scripts aren't part of the web app.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const CHECKED = ["server/pb_hooks", "server/pb_migrations", "web", ":(exclude)web/android", ":(exclude)web/scripts"];

// Stops the script (nothing done yet) if the server code or the web app has
// anything uncommitted. `sending` says what was about to happen, for the
// message.
export function refuseUncommittedCode(sending) {
  const uncommitted = execFileSync("git", ["status", "--porcelain", "--", ...CHECKED], {
    cwd: root,
    encoding: "utf8",
  });
  if (uncommitted.trim()) {
    console.error(
      `\nNothing was ${sending}: these files aren't committed:\n${uncommitted.trimEnd()}\n` +
        "Commit them first (if another session is still working on them, wait for it to finish), or remove them if they're strays."
    );
    process.exit(1);
  }
}

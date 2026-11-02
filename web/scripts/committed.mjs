// Only committed server code leaves this PC: deploy (to the Pi), release
// (the APK carries pb_hooks and pb_migrations for phone-only mode; see
// copyBentoServerCode in android/app/build.gradle) and package (the friends'
// zip) all call this first. A stray file in pb_migrations (PocketBase writes
// one when a test server's settings are changed with automigrate on), or a
// migration still being written, would otherwise change a real database. On
// phones and friends' servers that can't be undone: PocketBase runs each
// migration file once, so a later fix to it never reaches them.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Stops the script (nothing done yet) if server/pb_hooks or
// server/pb_migrations has anything uncommitted. `sending` says what was
// about to happen, for the message.
export function refuseUncommittedServerCode(sending) {
  const uncommitted = execFileSync("git", ["status", "--porcelain", "--", "server/pb_hooks", "server/pb_migrations"], {
    cwd: root,
    encoding: "utf8",
  });
  if (uncommitted.trim()) {
    console.error(
      `\nNothing was ${sending}: these server files aren't committed:\n${uncommitted.trimEnd()}\n` +
        "Commit them, or remove them if they're strays."
    );
    process.exit(1);
  }
}

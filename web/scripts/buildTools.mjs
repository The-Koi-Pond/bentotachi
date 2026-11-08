// Running the Android build from release.mjs and play.mjs, with Android
// Studio's bundled Java 21: the PC's own JAVA_HOME is Java 17, too old for
// Android's build tools. BENTO_JAVA_HOME points elsewhere if needed.

import { execSync } from "node:child_process";

export const JAVA_HOME = process.env.BENTO_JAVA_HOME || "C:\\Program Files\\Android\\Android Studio\\jbr";

// Shows the command, runs it in `cwd`, and stops the script if it fails.
export function run(command, cwd, extraEnv = {}) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd, stdio: "inherit", env: { ...process.env, JAVA_HOME, ...extraEnv } });
}

// Builds the Google Play version of the Android app: an app bundle (.aab)
// to upload in Play Console, signed with Bento's key (Play's "upload key";
// Play then signs what it hands out with its own key).
//
//   npm run play
//
// It differs from the APK "npm run release" publishes: no self-updater, no
// update banner or "Check for updates", no tip link, and no
// REQUEST_INSTALL_PACKAGES permission (Play refuses apps that update
// themselves). The web part is built with VITE_BENTO_PLAY=1 (appUpdates.ts),
// the Android part with -PbentoPlay (android/app/build.gradle).
//
// It uses the version number in android/app/build.gradle as it is. Play
// needs a higher one for every upload, so run "npm run release" first when
// there's something new (it bumps the number), then this.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refuseUncommittedCode } from "./committed.mjs";
import { runTests } from "./tests.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(web, "android");
const javaHome = process.env.BENTO_JAVA_HOME || "C:\\Program Files\\Android\\Android Studio\\jbr";

if (!existsSync(join(android, "keystore.properties"))) {
  console.error(
    "No android/keystore.properties, so the bundle can't be signed with Bento's key (Play's upload key).\n" +
      "Nothing was built. Put keystore.properties back (see the top of android/app/build.gradle)."
  );
  process.exit(1);
}
// The app carries the web app, and the server code for phone-only mode (see
// committed.mjs).
refuseUncommittedCode("built");
await runTests();

function run(command, cwd, extraEnv = {}) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd, stdio: "inherit", env: { ...process.env, JAVA_HOME: javaHome, ...extraEnv } });
}

run("npm run android", web, { VITE_BENTO_PLAY: "1" });
run(`"${join(android, "gradlew.bat")}" bundleRelease -PbentoPlay --console=plain`, android);

// Check the permission Play refuses really is gone from what was built.
function findFiles(folder, name) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    return statSync(path).isDirectory() ? findFiles(path, name) : entry === name ? [path] : [];
  });
}
const manifests = findFiles(join(android, "app", "build", "intermediates"), "AndroidManifest.xml").filter((path) =>
  /merged_manifest[s]?[\\/]release/.test(path)
);
if (!manifests.length) {
  console.error("\nCouldn't find the built app's manifest to check its permissions. Don't upload this bundle; check play.mjs.");
  process.exit(1);
}
if (manifests.some((path) => readFileSync(path, "utf8").includes("REQUEST_INSTALL_PACKAGES"))) {
  console.error("\nThe bundle still asks for REQUEST_INSTALL_PACKAGES, which Play refuses. Don't upload it.");
  process.exit(1);
}

const gradle = readFileSync(join(android, "app", "build.gradle"), "utf8");
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1];
const versionName = gradle.match(/versionName\s+"([^"]*)"/)?.[1];
const bundle = join(android, "app", "build", "outputs", "bundle", "release", "app-release.aab");
console.log(
  `\nBuilt the Google Play bundle: Bentotachi ${versionName} (version ${versionCode}), without the self-updater.\n` +
    `Upload this file in Play Console:\n  ${bundle}\n` +
    "Play needs a higher version number for every upload: run npm run release first next time there's something new.\n" +
    "(The web build in android/ is now the Play one; npm run release and npm run android rebuild it as usual.)"
);

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
//
// Uploading it too (2026-11-07), instead of by hand in Play Console:
//
//   npm run play -- upload internal "What's new, for testers"
//
// puts it on that testing track (internal, or alpha for closed testing, or
// a custom track's name; several with commas, "internal,alpha") through the
// upload robot (playUpload.mjs; its key is android/play-publisher.json).
// The notes are optional.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refuseUncommittedCode } from "./committed.mjs";
import { runTests } from "./tests.mjs";
import { uploadBundle } from "./playUpload.mjs";
import { run } from "./buildTools.mjs";
import { lintAndroid } from "./android-lint.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(web, "android");
const [action, track, ...noteWords] = process.argv.slice(2);
const keyFile = join(android, "play-publisher.json");
if (action && action !== "upload") {
  console.error('Usage: npm run play  (build only), or  npm run play -- upload <track> "notes"');
  process.exit(1);
}
if (action === "upload" && (!track || !existsSync(keyFile))) {
  console.error(
    !track
      ? "Which track? For example: npm run play -- upload internal"
      : "No android/play-publisher.json (the upload robot's key), so it can't upload. Nothing was built."
  );
  process.exit(1);
}

if (!existsSync(join(android, "keystore.properties"))) {
  console.error(
    "No android/keystore.properties, so the bundle can't be signed with Bento's key (Play's upload key).\n" +
      "Nothing was built. Put keystore.properties back (see the top of android/app/build.gradle)."
  );
  process.exit(1);
}
// The app carries the web app, the Android code, and the server code and
// Go server for phone-only mode (see committed.mjs).
refuseUncommittedCode("built", { app: true });
await runTests();

run("npm run android", web, { VITE_BENTO_PLAY: "1" });
lintAndroid();
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
console.log(`\nBuilt the Google Play bundle: Bentotachi ${versionName} (version ${versionCode}), without the self-updater.`);
console.log("(The web build in android/ is now the Play one; npm run release and npm run android rebuild it as usual.)");

if (action === "upload") {
  try {
    const uploaded = await uploadBundle({ keyFile, packageName: "com.xel.bento", bundleFile: bundle, track, notes: noteWords.join(" ").trim() });
    console.log(`\nUploaded version ${uploaded.versionCode} to: ${track}. Google reviews it as usual; Play Console shows its progress.`);
    if (uploaded.drafts.length) {
      console.log(
        `On ${uploaded.drafts.join(", ")} it's a draft (that track isn't live yet): finish it in Play Console → that track → Edit release → Send for review.`
      );
    }
  } catch (err) {
    console.error(`\nThe upload didn't go through: ${err.message}\nThe bundle is built; you can still upload it in Play Console:\n  ${bundle}`);
    process.exit(1);
  }
} else {
  console.log(
    `Upload this file in Play Console:\n  ${bundle}\n` +
      "Play needs a higher version number for every upload: run npm run release first next time there's something new."
  );
}

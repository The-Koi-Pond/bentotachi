// Builds a new version of the Android app and publishes it to the server,
// where the installed apps find it and offer to update.
//
//   npm run release -- "What changed, in a few words"          1.2.0 -> 1.2.1
//   npm run release -- minor "A new feature"                    1.2.1 -> 1.3.0
//   npm run release -- major "Something big"                    1.3.0 -> 2.0.0
//
// Steps: run both test suites (stopping if any fails), bump the version in
// android/app/build.gradle, build the web app, build the APK signed with
// Bento's key (android/keystore.properties), then copy it into
// server/releases/ with latest.json describing it.
//
// Without keystore.properties it stops: phones with Bento's own build can't
// install one signed with Android Studio's test key, and would keep being
// offered it. Only for a server whose phones all have test-key builds:
//   npm run release -- --test-key "What changed"

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refuseUncommittedCode } from "./committed.mjs";
import { runTests } from "./tests.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(web, "android");
const releases = join(web, "..", "server", "releases");
const gradleFile = join(android, "app", "build.gradle");
const args = process.argv.slice(2).filter((arg) => arg !== "--test-key");
const testKey = process.argv.includes("--test-key");
const step = ["major", "minor", "patch"].includes(args[0]) ? args.shift() : "patch";
const notes = args.join(" ").trim();

const signed = existsSync(join(android, "keystore.properties"));
if (!signed && !testKey) {
  console.error(
    "No android/keystore.properties, so this can't be signed with Bento's key, and installed phones couldn't install it.\n" +
      "Nothing was built. Put keystore.properties back (see the top of android/app/build.gradle), or use --test-key\n" +
      "only if every phone on this server has a test-key build."
  );
  process.exit(1);
}
// The APK carries the web app, and the server code for phone-only mode (see
// committed.mjs).
refuseUncommittedCode("built");
await runTests();

// Android Studio's bundled Java 21. The PC's own JAVA_HOME is Java 17,
// which is too old for Android's build tools.
const javaHome = process.env.BENTO_JAVA_HOME || "C:\\Program Files\\Android\\Android Studio\\jbr";

function run(command, cwd) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd, stdio: "inherit", env: { ...process.env, JAVA_HOME: javaHome } });
}

// 1. Next version number. versionCode is what Android compares (it just
//    counts up); versionName is what people see, like 1.2.1.
const gradle = readFileSync(gradleFile, "utf8");
const current = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
const currentName = gradle.match(/versionName\s+"([^"]*)"/)?.[1];
if (!current || !currentName) throw new Error("Couldn't find versionCode/versionName in android/app/build.gradle");
const versionCode = current + 1;
const versionName = nextVersionName(currentName, step);

// "1.2" counts as 1.2.0.
function nextVersionName(name, part) {
  const [major = 1, minor = 0, patch = 0] = name.split(".").map((n) => Number(n) || 0);
  if (part === "major") return `${major + 1}.0.0`;
  if (part === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}
writeFileSync(
  gradleFile,
  gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`)
);
console.log(`Building Bentotachi ${versionName} (version ${versionCode})`);

// 2. Web app into the Android project, then 3. the APK. If either fails,
//    put the old version number back so the next try reuses this one.
try {
  run("npm run android", web);
  if (!signed) console.warn("\n--test-key: signing with Android Studio's test key.");
  run(`"${join(android, "gradlew.bat")}" ${signed ? "assembleRelease" : "assembleDebug"} --console=plain`, android);
} catch (err) {
  writeFileSync(gradleFile, gradle);
  console.error(`\nThe build failed, so nothing was published. The version is back to ${current}.`);
  process.exit(1);
}
const built = signed
  ? join(android, "app", "build", "outputs", "apk", "release", "app-release.apk")
  : join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");

// 4. Publish: the APK and a description of it. Keep the previous APK too,
//    and remove older ones.
mkdirSync(releases, { recursive: true });
const file = `bento-${versionCode}.apk`;
copyFileSync(built, join(releases, file));
writeFileSync(
  join(releases, "latest.json"),
  JSON.stringify({ versionCode, versionName, file, notes, signedWith: signed ? "bento" : "test", published: new Date().toISOString() }, null, 2)
);
for (const old of readdirSync(releases)) {
  const code = Number(old.match(/^bento-(\d+)\.apk$/)?.[1]);
  if (code && code < versionCode - 1) rmSync(join(releases, old));
}

console.log(`\nPublished Bentotachi ${versionName}. Installed apps will offer the update next time they're opened.`);
// The new version number only lives in build.gradle until it's committed:
// lost (a fresh clone, or the change undone), the next release would reuse
// a number phones already have, and they'd never be offered it.
console.log(
  `\nCommit web/android/app/build.gradle now (version ${versionCode}), so the next release doesn't reuse this number.` +
    "\nThen npm run deploy sends the app to the Pi."
);
// The website's "What's new" page and feed only list what someone adds, so
// say so while the release is fresh (the website's CLAUDE.md has the how).
console.log(
  `\nThen add ${versionName} to the website's "What's new": bentotachi/changelog.html and changelog.xml in the` +
    ' website repository (github.com/The-Koi-Pond/the-koi-pond.github.io; its CLAUDE.md, "Bentotachi\'s changelog",' +
    " says how). Write it from this release's notes in docs/PLAN.md, in plain words for people who use the app," +
    " and push it once Xel says go."
);

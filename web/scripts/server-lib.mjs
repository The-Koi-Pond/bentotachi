// Builds the server that phone-only mode runs inside the Android app
// (mobile/bentoserver, with Go and gomobile) into
// android/app/libs/bentoserver.aar. Runs as part of `npm run android`, and
// only rebuilds (after the Go tests pass) when the Go code has changed since
// the last build.
//
//   npm run server-lib            (from the web folder)
//
// Needs Go, and gomobile set up once (see mobile/README.md). Builds for real
// phones, 64-bit (arm64) and older 32-bit ones (arm, ARMv7); Google Play
// gives each phone only its own copy. The PC's emulator can't run it either way (its x86
// Android blocks a system call the database uses, and its ARM translation
// can't run Go), so phone-only mode is tested on a real phone. "-s -w" leaves out debugging
// information, which phones never need (it nearly halves the size).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const mobile = join(web, "..", "mobile");
const libs = join(web, "android", "app", "libs");
const aar = join(libs, "bentoserver.aar");

// The newest change to the Go code.
function newest(folder) {
  let latest = 0;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) latest = Math.max(latest, newest(path));
    else if (/\.(go|mod|sum)$/.test(entry.name)) latest = Math.max(latest, statSync(path).mtimeMs);
  }
  return latest;
}

// This script counts too: a change to how it builds (like which phones)
// needs a new build even when the Go code hasn't changed.
const thisScript = statSync(fileURLToPath(import.meta.url)).mtimeMs;
if (existsSync(aar) && statSync(aar).mtimeMs > Math.max(newest(mobile), thisScript)) {
  console.log("Phone server library is up to date.");
  process.exit(0);
}

// The Go tests run the phone server with the real hooks and migrations, so a
// change that breaks it stops here rather than reaching phones.
console.log("> go test ./... (the phone server's tests)");
try {
  execFileSync("go", ["test", "./..."], { cwd: mobile, stdio: "inherit" });
} catch (error) {
  console.error(error.code === "ENOENT"
    ? "Go isn't installed (or isn't on PATH): see mobile/README.md."
    : "The phone server's Go tests failed (above), so it wasn't rebuilt. Fix them, then try again.");
  process.exit(1);
}

const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const ndkFolder = join(sdk, "ndk");
const ndk = process.env.ANDROID_NDK_HOME ?? (existsSync(ndkFolder) ? join(ndkFolder, readdirSync(ndkFolder).sort().pop()) : "");
if (!ndk) {
  console.error("No Android NDK found. Install it in Android Studio: SDK Manager > SDK Tools > NDK.");
  process.exit(1);
}
const goBin = join(execFileSync("go", ["env", "GOPATH"], { encoding: "utf8" }).trim(), "bin");
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_NDK_HOME: ndk, PATH: `${goBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}` };

mkdirSync(libs, { recursive: true });
console.log("> gomobile bind (building the phone server, about a minute)");
execFileSync(
  "gomobile",
  ["bind", "-target=android/arm,android/arm64", "-androidapi", "24", "-trimpath", "-ldflags=-s -w", "-javapkg", "com.xel.bento.server", "-o", aar, "./bentoserver"],
  { cwd: mobile, env, stdio: "inherit" },
);

// Opens Bentotachi in the "Bentotachi" Android emulator (a virtual Pixel 7
// Pro) for Xel to look around: the newest commit, built as the Play
// version's test copy (com.xel.bento.test). It builds in its own copy of the
// repository (%LOCALAPPDATA%\Bentotachi emulator\copy, a git worktree), so
// other sessions' unfinished work never shows up, and only rebuilds when the
// commit changed. The emulator can't run phone-only mode (see
// server-lib.mjs), so log in to the Pi there.
//
//   node scripts/emulator.mjs                 build if needed, start, install, open
//   node scripts/emulator.mjs size big|small|tiny
//   node scripts/emulator.mjs text big|normal
//
// The desktop shortcuts run these through the .cmd files beside the copy.

import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./buildTools.mjs";

const AVD = "Bentotachi";
const APP = "com.xel.bento.test";
const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(web, "..");
const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const adbExe = join(sdk, "platform-tools", "adb.exe");
const state = join(process.env.LOCALAPPDATA ?? "", "Bentotachi emulator");
const copy = join(state, "copy");
const copyWeb = join(copy, "web");
const apk = join(copyWeb, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const builtFile = join(state, "built-commit.txt");
const lockFile = join(state, "package-lock.json");

// Screen sizes by width in dp, which is what the layout sees: big is Xel's
// Pixel 7 Pro (412 dp), small a common smaller Android (360 dp), tiny the
// narrowest phones still around (320 dp).
const SIZES = {
  big: null,
  small: { size: "1080x2340", density: 480 },
  tiny: { size: "720x1520", density: 360 },
};

const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const adb = (serial, ...args) =>
  execFileSync(adbExe, serial ? ["-s", serial, ...args] : args, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// The running emulator that is this AVD (the PC may run others, like De-Koi's).
function bentoSerial() {
  const serials = adb(null, "devices")
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([serial, status]) => serial.startsWith("emulator-") && status === "device")
    .map(([serial]) => serial);
  return serials.find((serial) => {
    try {
      return adb(serial, "emu", "avd", "name").split("\n")[0].trim() === AVD;
    } catch {
      return false;
    }
  });
}

async function startEmulator() {
  const already = bentoSerial();
  if (already) return already;
  console.log("\nStarting the Bentotachi emulator (its window opens in a moment)...");
  spawn(join(sdk, "emulator", "emulator.exe"), ["-avd", AVD], { detached: true, stdio: "ignore" }).unref();
  for (let waited = 0; waited < 240; waited += 3) {
    await sleep(3000);
    const serial = bentoSerial();
    if (serial && adb(serial, "shell", "getprop", "sys.boot_completed") === "1") return serial;
  }
  throw new Error("The emulator didn't finish starting within 4 minutes.");
}

function build(commit) {
  console.log(`\nBuilding commit ${commit.slice(0, 8)} for the emulator.`);
  mkdirSync(state, { recursive: true });
  if (!existsSync(copy)) git("worktree", "add", "--detach", copy, commit);
  else execFileSync("git", ["checkout", "--detach", commit], { cwd: copy, stdio: "inherit" });

  const lock = readFileSync(join(copyWeb, "package-lock.json"), "utf8");
  if (!existsSync(join(copyWeb, "node_modules")) || !existsSync(lockFile) || readFileSync(lockFile, "utf8") !== lock) {
    run("npm ci", copyWeb);
    writeFileSync(lockFile, lock);
  }

  // The phone server library only runs in phone-only mode, which the
  // emulator can't run, so reuse the main folder's instead of building Go.
  const aar = join(web, "android", "app", "libs", "bentoserver.aar");
  if (existsSync(aar)) {
    const target = join(copyWeb, "android", "app", "libs", "bentoserver.aar");
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(aar, target);
    const now = new Date();
    utimesSync(target, now, now);
  }

  run("npm run android", copyWeb, { VITE_BENTO_PLAY: "1", ANDROID_HOME: sdk });
  run(`"${join(copyWeb, "android", "gradlew.bat")}" assembleDebug -PbentoTest -PbentoPlay --console=plain`, join(copyWeb, "android"), {
    ANDROID_HOME: sdk,
  });
  writeFileSync(builtFile, commit);
}

async function open() {
  const commit = git("rev-parse", "HEAD");
  const built = existsSync(builtFile) ? readFileSync(builtFile, "utf8").trim() : "";
  const fresh = built !== commit || !existsSync(apk);
  if (fresh) build(commit);
  else console.log(`Commit ${commit.slice(0, 8)} is already built.`);

  const serial = await startEmulator();
  adb(serial, "shell", "cmd", "uimode", "night", "yes"); // Xel's phone runs in dark mode
  if (fresh || !adb(serial, "shell", "pm", "list", "packages", APP).includes(APP)) {
    console.log("\nInstalling...");
    adb(serial, "install", "-r", apk);
  }
  adb(serial, "shell", "monkey", "-p", APP, "-c", "android.intent.category.LAUNCHER", "1");
  console.log(`\nBentotachi (test) is open, commit ${commit.slice(0, 8)}. Log in to the Pi: the data there is real.`);
}

function resize(name) {
  const serial = bentoSerial();
  if (!serial) throw new Error("The Bentotachi emulator isn't running: open it with the Bentotachi Emulator shortcut first.");
  if (!(name in SIZES)) throw new Error(`Sizes: ${Object.keys(SIZES).join(", ")}`);
  const preset = SIZES[name];
  adb(serial, "shell", "wm", "size", preset ? preset.size : "reset");
  adb(serial, "shell", "wm", "density", preset ? String(preset.density) : "reset");
  console.log(`Screen is now ${name}.`);
}

function textSize(name) {
  const serial = bentoSerial();
  if (!serial) throw new Error("The Bentotachi emulator isn't running: open it with the Bentotachi Emulator shortcut first.");
  const scale = { big: "1.3", normal: "1.0" }[name];
  if (!scale) throw new Error("Text sizes: big, normal");
  adb(serial, "shell", "settings", "put", "system", "font_scale", scale);
  console.log(`Text is now ${name}.`);
}

const [command, value] = process.argv.slice(2);
try {
  if (!command) await open();
  else if (command === "size") resize(value);
  else if (command === "text") textSize(value);
  else throw new Error("Use: node scripts/emulator.mjs [size big|small|tiny | text big|normal]");
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}

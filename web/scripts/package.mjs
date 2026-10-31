// Makes a zip of Bento for friends to run their own server:
//
//   npm run package          (from the web folder)
//
// It builds the web app, then copies only what a new server needs into
// share/Bento-<version>.zip: the PocketBase program, Bento's database
// changes and hooks, the built app, the latest Android app from
// server/releases, Start Bento.bat, and the setup guide. Never the
// database (pb_data), backups, the signing key or its password: it only
// copies the files listed below, and checks before zipping.
//
// Make a release first (npm run release) if the phones should get the
// newest app; the zip includes whatever server/releases has now.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(web, "..");
const server = join(root, "server");
const share = join(root, "share");

const latest = JSON.parse(readFileSync(join(server, "releases", "latest.json"), "utf8"));
const version = latest.versionName;
const staging = join(share, "staging");
const bento = join(staging, "Bento");
const zip = join(share, `Bento-${version}.zip`);

console.log(`> npm run build`);
execSync("npm run build", { cwd: web, stdio: "inherit" });

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(bento, "server", "releases"), { recursive: true });

// [from, to] inside the Bento folder. Nothing else is copied.
const copies = [
  [join(web, "scripts", "package-files", "Start Bento.bat"), "Start Bento.bat"],
  [join(web, "public", "guide.html"), "HOW TO SET UP BENTO.html"],
  [join(server, "pocketbase.exe"), "server/pocketbase.exe"],
  [join(server, "pb_migrations"), "server/pb_migrations"],
  [join(server, "pb_hooks"), "server/pb_hooks"],
  [join(server, "pb_public"), "server/pb_public"],
  [join(server, "releases", "latest.json"), "server/releases/latest.json"],
  [join(server, "releases", latest.file), `server/releases/${latest.file}`],
];
if (existsSync(join(server, "LICENSE.md"))) copies.push([join(server, "LICENSE.md"), "server/POCKETBASE-LICENSE.md"]);

for (const [from, to] of copies) {
  if (!existsSync(from)) throw new Error(`Missing ${from}; nothing was packaged.`);
  cpSync(from, join(bento, to), { recursive: true });
}

// Every file that's about to go in the zip, for a last check.
function filesIn(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesIn(path) : [relative(staging, path)];
  });
}
const files = filesIn(staging);
const private_ = files.filter((file) => /pb_data|backups|keystore|\.jks$|signing|\.env$/i.test(file));
if (private_.length) {
  rmSync(staging, { recursive: true, force: true });
  throw new Error(`Refusing to package private files: ${private_.join(", ")}`);
}

// Windows' own tar can make zip files.
rmSync(zip, { force: true });
execSync(`"${process.env.SystemRoot}\\System32\\tar.exe" -a -c -f "${zip}" -C "${staging}" Bento`, { stdio: "inherit" });
rmSync(staging, { recursive: true, force: true });

const megabytes = (statSync(zip).size / 1024 / 1024).toFixed(1);
console.log(`\nMade ${relative(root, zip)} (${megabytes} MB, ${files.length} files, Bento ${version}).`);
console.log("Send it to a friend along with 'HOW TO SET UP BENTO.html' inside it.");

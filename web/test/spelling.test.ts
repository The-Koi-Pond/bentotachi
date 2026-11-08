import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spelled, US_SPELLING } from "../src/spelling.ts";

test("a US household sees American spelling, keeping capitals", () => {
  assert.equal(spelled("My favourites", "US"), "My favorites");
  assert.equal(spelled("Favourite brand", "US"), "Favorite brand");
  assert.equal(spelled("Profile, colour and password", "US"), "Profile, color and password");
  assert.equal(spelled("Soft italics (greyed out)", "US"), "Soft italics (grayed out)");
});

test("everywhere else sees the text as written, and only whole words change", () => {
  for (const country of ["AU", "GB", "NZ", "NL", ""]) assert.equal(spelled("My favourites", country), "My favourites");
  assert.equal(spelled("greyhound colourful", "US"), "greyhound colourful");
});

// Every line of the app that shows one of the listed words goes through
// spell() (household.ts's useSpell), so a US household never sees a
// stray Australian one. A line whose text is spelled elsewhere says so
// with "// shown through spell()".
test("every listed word on screen goes through spell()", () => {
  const words = new RegExp(`\\b(${Object.keys(US_SPELLING).join("|")})\\b`, "i");
  const src = join(import.meta.dirname, "..", "src");
  const missed: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && entry.name !== "spelling.ts") {
        readFileSync(path, "utf8")
          .split("\n")
          .forEach((line, i) => {
            const code = line.replace(/(^|\s)\/\/.*$/, "");
            if (/^\s*(\*|\/\*|\{\/\*)/.test(line) || !words.test(code)) return;
            if (!/spell\(/.test(code) && !/\/\/ shown through spell\(\)/.test(line)) missed.push(`${entry.name}:${i + 1}: ${line.trim()}`);
          });
      }
    }
  };
  walk(src);
  assert.deepEqual(missed, []);
});

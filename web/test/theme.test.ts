// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { themedMedia } from "../src/theme.ts";

test("a dark-mode block follows the choice", () => {
  const dark = "(prefers-color-scheme: dark)";
  assert.equal(themedMedia(dark, "auto"), dark, "Auto leaves it to the device");
  assert.equal(themedMedia(dark, "dark"), "all", "Dark: always on");
  assert.equal(themedMedia(dark, "light"), "not all", "Light: never on");
  assert.equal(themedMedia(`${dark} and (max-width: 520px)`, "dark"), "all and (max-width: 520px)");
});

test("other blocks are left alone", () => {
  assert.equal(themedMedia("print", "dark"), "print");
  assert.equal(themedMedia("(max-width: 520px)", "light"), "(max-width: 520px)");
  assert.equal(themedMedia("(prefers-reduced-motion: reduce)", "dark"), "(prefers-reduced-motion: reduce)");
});

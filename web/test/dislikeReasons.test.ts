// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { addReasons, MAX_REASONS, suggestedReasons } from "../src/dislikeReasons.ts";

test("adds typed reasons as tags, splitting on commas", () => {
  assert.deepEqual(addReasons([], "baked pineapple"), ["baked pineapple"]);
  assert.deepEqual(addReasons(["too sweet"], " coriander ,  soggy   pastry, "), ["too sweet", "coriander", "soggy pastry"]);
});

test("skips blanks and repeats, ignoring capitals", () => {
  assert.deepEqual(addReasons(["Baked pineapple"], "baked PINEAPPLE, , "), ["Baked pineapple"]);
});

test("keeps tags short and the list limited", () => {
  assert.equal(addReasons([], "x".repeat(80))[0].length, 40);
  const full = Array.from({ length: MAX_REASONS }, (_, i) => `reason ${i}`);
  assert.deepEqual(addReasons(full, "one more"), full);
});

test("suggests reasons used elsewhere, most used first, not ones already here", () => {
  const used = [["baked pineapple", "too sweet"], ["Baked pineapple"], ["coriander"], ["too sweet"], ["baked pineapple"]];
  assert.deepEqual(suggestedReasons(used, []), ["baked pineapple", "too sweet", "coriander"]);
  assert.deepEqual(suggestedReasons(used, ["Too sweet"]), ["baked pineapple", "coriander"]);
  assert.deepEqual(suggestedReasons(used, [], 1), ["baked pineapple"]);
});

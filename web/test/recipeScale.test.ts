// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { scaleOf, withScale } from "../src/recipeScale.ts";

test("a recipe opens at the size it was last made", () => {
  let scales = withScale({}, "r1", 1.5);
  assert.equal(scaleOf(scales, "r1"), 1.5);
  // Others are untouched and open as written.
  assert.equal(scaleOf(scales, "r2"), 1);
  scales = withScale(scales, "r2", 0.5);
  assert.deepEqual(scales, { r1: 1.5, r2: 0.5 });
  // Back to as written: forgotten, not kept as 1.
  assert.deepEqual(withScale(scales, "r1", 1), { r2: 0.5 });
});

test("a damaged saved size opens as written", () => {
  assert.equal(scaleOf({ r1: 0 }, "r1"), 1);
  assert.equal(scaleOf({ r1: -2 }, "r1"), 1);
  assert.equal(scaleOf({ r1: "2" as unknown as number }, "r1"), 1);
  assert.deepEqual(withScale({ r1: 2 }, "r1", Number.NaN), {});
});

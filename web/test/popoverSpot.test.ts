// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { popoverSpot } from "../src/popoverSpot.ts";

const phone = { width: 412, height: 800 };
const bubble = { width: 320, height: 90 };

test("a tip opens under its ?, lined up with it, pointing at it", () => {
  const spot = popoverSpot({ left: 60, top: 200, width: 24, height: 24 }, bubble, phone);
  assert.deepEqual(spot, { left: 48, top: 232, above: false, pointer: 24 });
});

test("near the right edge it moves left to stay on screen, still pointing at the ?", () => {
  const spot = popoverSpot({ left: 370, top: 200, width: 24, height: 24 }, bubble, phone);
  assert.equal(spot.left, 412 - 8 - 320);
  assert.equal(spot.pointer, 370 + 12 - spot.left);
});

test("with no room below, it opens above; with no room either way, below", () => {
  const low = popoverSpot({ left: 100, top: 740, width: 24, height: 24 }, bubble, phone);
  assert.deepEqual([low.above, low.top], [true, 740 - 8 - 90]);
  const tiny = popoverSpot({ left: 100, top: 40, width: 24, height: 24 }, { width: 320, height: 900 }, phone);
  assert.equal(tiny.above, false);
});

test("a narrow screen keeps the bubble inside both edges", () => {
  const spot = popoverSpot({ left: 10, top: 100, width: 24, height: 24 }, { width: 500, height: 80 }, { width: 320, height: 600 });
  assert.equal(spot.left, 8);
  assert.ok(spot.pointer >= 12);
});

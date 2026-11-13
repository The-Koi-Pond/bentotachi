// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { zoomFrom } from "../src/textZoom.ts";

test("Android's text size shows as the root drawn bigger than a rem", () => {
  assert.equal(zoomFrom(32, 16), 2);
  assert.equal(zoomFrom(20.8, 16), 1.3);
});

test("a browser's own text size scales rem too, so no extra zoom", () => {
  assert.equal(zoomFrom(16, 16), 1);
  assert.equal(zoomFrom(32, 32), 1);
});

test("smaller text than normal shrinks too, and nonsense counts as none", () => {
  assert.equal(zoomFrom(13.6, 16), 0.85);
  assert.equal(zoomFrom(Number.NaN, 16), 1);
  assert.equal(zoomFrom(16, 0), 1);
});

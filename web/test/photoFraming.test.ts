// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { CENTRED, framingOf, framingStyle, panned, zoomed } from "../src/photoFraming.ts";

test("a missing or garbled framing is centred", () => {
  assert.deepEqual(framingOf(null), CENTRED);
  assert.deepEqual(framingOf("nope"), CENTRED);
  assert.deepEqual(framingOf({ x: "left", y: 20, zoom: 9 }), { x: 50, y: 20, zoom: 3 });
});

test("dragging moves the focus the other way, less when zoomed in", () => {
  assert.deepEqual(panned(CENTRED, 0.1, 0), { x: 40, y: 50, zoom: 1 });
  assert.deepEqual(panned({ x: 50, y: 50, zoom: 2 }, 0, -0.2), { x: 50, y: 60, zoom: 2 });
  assert.deepEqual(panned({ x: 5, y: 95, zoom: 1 }, 0.5, -0.5), { x: 0, y: 100, zoom: 1 });
});

test("zoom stays between 1 and 3", () => {
  assert.equal(zoomed(CENTRED, 5).zoom, 3);
  assert.equal(zoomed(CENTRED, 0.2).zoom, 1);
});

test("the style keeps the focus in view and zooms around it", () => {
  assert.deepEqual(framingStyle(CENTRED), { objectPosition: "50% 50%" });
  // Twice as big around the middle, clipped to the middle half (which,
  // enlarged, fills the box exactly).
  assert.deepEqual(framingStyle({ x: 50, y: 50, zoom: 2 }), {
    objectPosition: "50% 50%",
    transform: "scale(2)",
    transformOrigin: "50% 50%",
    clipPath: "inset(25% 25% 25% 25% round calc(var(--photo-radius, 0px) / 2))",
  });
  // Zoomed towards a corner, the clip keeps to that corner.
  assert.deepEqual(framingStyle({ x: 0, y: 100, zoom: 2 }).clipPath, "inset(50% 50% 0% 0% round calc(var(--photo-radius, 0px) / 2))");
});

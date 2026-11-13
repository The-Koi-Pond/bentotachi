// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { TICKS_LAST_MS, linesOf, ticksOf, withTicks } from "../src/recipeTicks.ts";

const NOW = Date.UTC(2026, 10, 12, 8);
const HOUR = 60 * 60 * 1000;
const LINES = linesOf(["1 onion", "2 carrots"], ["Chop.", "Simmer 20 min."]);

test("ticks come back while fresh, for the same recipe", () => {
  const all = withTicks({}, "r1", NOW, LINES, ["i0", "s1"]);
  assert.deepEqual(ticksOf(all, "r1", NOW + HOUR, LINES), ["i0", "s1"]);
  assert.deepEqual(ticksOf(all, "r2", NOW, LINES), [], "other recipes start clean");
});

test("cooking past midnight keeps them; the next day's cook starts clean", () => {
  const lateTick = Date.UTC(2026, 10, 12, 23, 50);
  const all = withTicks({}, "r1", lateTick, LINES, ["i0"]);
  assert.deepEqual(ticksOf(all, "r1", lateTick + 20 * 60 * 1000, LINES), ["i0"], "ten past midnight");
  assert.deepEqual(ticksOf(all, "r1", lateTick + TICKS_LAST_MS - 1, LINES), ["i0"]);
  assert.deepEqual(ticksOf(all, "r1", lateTick + TICKS_LAST_MS, LINES), [], "12 hours after the last tick");
});

test("each tick starts the 12 hours again", () => {
  let all = withTicks({}, "r1", NOW, LINES, ["i0"]);
  all = withTicks(all, "r1", NOW + 10 * HOUR, LINES, ["i0", "i1"]);
  assert.deepEqual(ticksOf(all, "r1", NOW + 20 * HOUR, LINES), ["i0", "i1"]);
});

test("after the ingredients or method change, they start clean", () => {
  const all = withTicks({}, "r1", NOW, LINES, ["i0"]);
  const added = linesOf(["1 onion", "1 garlic clove", "2 carrots"], ["Chop.", "Simmer 20 min."]);
  assert.deepEqual(ticksOf(all, "r1", NOW, added), []);
  const newMethod = linesOf(["1 onion", "2 carrots"], ["Chop.", "Fry 5 min.", "Simmer 20 min."]);
  assert.deepEqual(ticksOf(all, "r1", NOW, newMethod), [], "a changed method counts too");
});

test("two recipes cooked side by side keep their own ticks", () => {
  let all = withTicks({}, "main", NOW, LINES, ["i0"]);
  all = withTicks(all, "side", NOW, LINES, ["s1"]);
  assert.deepEqual(ticksOf(all, "main", NOW, LINES), ["i0"]);
  assert.deepEqual(ticksOf(all, "side", NOW, LINES), ["s1"]);
});

test("the fingerprint follows the lines, and only the lines", () => {
  assert.equal(linesOf(["1 onion"], ["Chop."]), linesOf(["1 onion"], ["Chop."]));
  assert.notEqual(linesOf(["1 onion"], ["Chop."]), linesOf(["Chop."], ["1 onion"]), "an ingredient isn't a step");
  assert.equal(linesOf(null, undefined), linesOf([], []));
});

test("unticking everything forgets the recipe; stale ones are cleared away", () => {
  let all = withTicks({}, "old", NOW - 2 * TICKS_LAST_MS, LINES, ["i1"]);
  all = withTicks(all, "r1", NOW, LINES, ["i0"]);
  assert.deepEqual(Object.keys(all), ["r1"], "the stale recipe is gone");
  all = withTicks(all, "r1", NOW, LINES, []);
  assert.deepEqual(all, {});
});

test("something else saved under the key is ignored, an older app's day-based ticks too", () => {
  const damaged = { r1: { at: NOW, lines: LINES, keys: [1, 2] }, r2: "x", r4: { day: "2026-11-12", lines: LINES, keys: ["i0"] } } as never;
  assert.deepEqual(ticksOf(damaged, "r1", NOW, LINES), []);
  assert.deepEqual(ticksOf(damaged, "r4", NOW, LINES), []);
  assert.deepEqual(withTicks(damaged, "r3", NOW, LINES, ["i0"]), { r3: { at: NOW, lines: LINES, keys: ["i0"] } });
});

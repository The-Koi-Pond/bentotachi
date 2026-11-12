// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { linesOf, ticksOf, withTicks } from "../src/recipeTicks.ts";

const TODAY = "2026-11-12";
const LINES = linesOf(["1 onion", "2 carrots"], ["Chop.", "Simmer 20 min."]);

test("ticks come back the same day, for the same recipe", () => {
  const all = withTicks({}, "r1", TODAY, LINES, ["i0", "s1"]);
  assert.deepEqual(ticksOf(all, "r1", TODAY, LINES), ["i0", "s1"]);
  assert.deepEqual(ticksOf(all, "r2", TODAY, LINES), [], "other recipes start clean");
});

test("the next day, or after the ingredients or method change, they start clean", () => {
  const all = withTicks({}, "r1", TODAY, LINES, ["i0"]);
  assert.deepEqual(ticksOf(all, "r1", "2026-11-13", LINES), []);
  const added = linesOf(["1 onion", "1 garlic clove", "2 carrots"], ["Chop.", "Simmer 20 min."]);
  assert.deepEqual(ticksOf(all, "r1", TODAY, added), []);
  const newMethod = linesOf(["1 onion", "2 carrots"], ["Chop.", "Fry 5 min.", "Simmer 20 min."]);
  assert.deepEqual(ticksOf(all, "r1", TODAY, newMethod), [], "a changed method counts too");
});

test("two recipes cooked side by side keep their own ticks", () => {
  let all = withTicks({}, "main", TODAY, LINES, ["i0"]);
  all = withTicks(all, "side", TODAY, LINES, ["s1"]);
  assert.deepEqual(ticksOf(all, "main", TODAY, LINES), ["i0"]);
  assert.deepEqual(ticksOf(all, "side", TODAY, LINES), ["s1"]);
});

test("the fingerprint follows the lines, and only the lines", () => {
  assert.equal(linesOf(["1 onion"], ["Chop."]), linesOf(["1 onion"], ["Chop."]));
  assert.notEqual(linesOf(["1 onion"], ["Chop."]), linesOf(["Chop."], ["1 onion"]), "an ingredient isn't a step");
  assert.equal(linesOf(null, undefined), linesOf([], []));
});

test("unticking everything forgets the recipe; old days are cleared away", () => {
  let all = withTicks({}, "old", "2026-11-10", LINES, ["i1"]);
  all = withTicks(all, "r1", TODAY, LINES, ["i0"]);
  assert.deepEqual(Object.keys(all), ["r1"], "yesterday's recipe is gone");
  all = withTicks(all, "r1", TODAY, LINES, []);
  assert.deepEqual(all, {});
});

test("something else saved under the key is ignored", () => {
  const damaged = { r1: { day: TODAY, lines: LINES, keys: [1, 2] }, r2: "x" } as never;
  assert.deepEqual(ticksOf(damaged, "r1", TODAY, LINES), []);
  assert.deepEqual(withTicks(damaged, "r3", TODAY, LINES, ["i0"]), { r3: { day: TODAY, lines: LINES, keys: ["i0"] } });
});

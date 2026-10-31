// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { clock, elapsed, finished, paused, recipeMinutes, resumed, startCooking, startTimer } from "../src/cookTiming.ts";

const MIN = 60_000;

test("prep, then cook, each counted from when it started", () => {
  let t = startTimer(0);
  assert.deepEqual(elapsed(t, 10 * MIN), { prep: 10 * MIN, cook: 0 });
  t = startCooking(t, 12 * MIN);
  assert.deepEqual(elapsed(t, 40 * MIN), { prep: 12 * MIN, cook: 28 * MIN });
  t = finished(t, 45 * MIN);
  // Done: nothing more is counted, however long it sits.
  assert.deepEqual(elapsed(t, 500 * MIN), { prep: 12 * MIN, cook: 33 * MIN });
});

test("time paused doesn't count", () => {
  let t = startTimer(0);
  t = paused(t, 5 * MIN);
  assert.deepEqual(elapsed(t, 30 * MIN), { prep: 5 * MIN, cook: 0 });
  t = resumed(t, 30 * MIN);
  assert.deepEqual(elapsed(t, 33 * MIN), { prep: 8 * MIN, cook: 0 });
  // Pausing twice, or resuming while running, changes nothing.
  assert.deepEqual(paused(paused(t, 34 * MIN), 40 * MIN), paused(t, 34 * MIN));
  assert.deepEqual(resumed(t, 40 * MIN), t);
});

test("cooking can start straight away (no prep), even while paused", () => {
  const t = startCooking(paused(startTimer(0), 0), 0);
  assert.deepEqual(elapsed(t, 20 * MIN), { prep: 0, cook: 20 * MIN });
});

test("clock and saved minutes", () => {
  assert.equal(clock(8 * MIN + 5000), "8:05");
  assert.equal(clock(62 * MIN + 9000), "1:02:09");
  assert.equal(recipeMinutes(0), 0);
  assert.equal(recipeMinutes(10_000), 1);
  assert.equal(recipeMinutes(7 * MIN + 20_000), 7);
  assert.equal(recipeMinutes(23 * MIN), 25);
  assert.equal(recipeMinutes(61 * MIN), 60);
});

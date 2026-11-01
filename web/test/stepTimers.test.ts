// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { countdown, formatDuration, pausedTimer, remaining, resumedTimer, startStepTimer, stepTimes } from "../src/stepTimers.ts";

const labels = (step: string) => stepTimes(step).map((t) => `${t.label}=${t.seconds}`);

test("times in a step", () => {
  assert.deepEqual(labels("Simmer for 10 minutes."), ["10 min=600"]);
  assert.deepEqual(labels("Bake 25 mins, then rest 5 min"), ["25 min=1500", "5 min=300"]);
  assert.deepEqual(labels("Roast for 1 hour"), ["1 h=3600"]);
  assert.deepEqual(labels("Cook 1½ hours"), ["1 h 30 min=5400"]);
  assert.deepEqual(labels("Blitz for 30 seconds"), ["30 sec=30"]);
  assert.deepEqual(labels("Rest 2hrs"), ["2 h=7200"]);
});

test("a range counts down from its shorter end", () => {
  assert.deepEqual(labels("Cook for 10-15 minutes until golden"), ["10–15 min=600"]);
  assert.deepEqual(labels("Bake 20 to 25 mins"), ["20–25 min=1200"]);
  assert.deepEqual(labels("Braise 1-1/2 hours"), ["1 h 30 min=5400"]);
});

test("hours and minutes together are one time", () => {
  assert.deepEqual(labels("Roast for 1 hour 30 minutes"), ["1 h 30 min=5400"]);
  assert.deepEqual(labels("Slow cook 2 hrs and 15 mins"), ["2 h 15 min=8100"]);
});

test("times said in words", () => {
  assert.deepEqual(labels("Leave for half an hour"), ["30 min=1800"]);
  assert.deepEqual(labels("Chill for an hour"), ["1 h=3600"]);
  assert.deepEqual(labels("Stir for a minute"), ["1 min=60"]);
});

test("no times, no repeats, nothing that only looks like one", () => {
  assert.deepEqual(labels("Season to taste."), []);
  assert.deepEqual(labels("Heat the oven to 180°C."), []);
  assert.deepEqual(labels("Stir 5 minutes, then another 5 minutes"), ["5 min=300"]);
  assert.deepEqual(labels("Cut into 2 cm pieces"), []);
  assert.deepEqual(labels("Add 2 hmm"), []);
});

test("durations and countdowns", () => {
  assert.equal(formatDuration(5400), "1 h 30 min");
  assert.equal(formatDuration(45), "45 sec");
  assert.equal(countdown(598_000), "9:58");
  assert.equal(countdown(3_900_000), "1:05:00");
  assert.equal(countdown(400), "0:01");
});

test("a countdown pauses and carries on", () => {
  const timer = startStepTimer("r1", "Soup", 2, { label: "10 min", seconds: 600 }, 0);
  assert.equal(remaining(timer, 60_000), 540_000);
  const paused = pausedTimer(timer, 60_000);
  assert.equal(remaining(paused, 999_999), 540_000);
  const resumed = resumedTimer(paused, 100_000);
  assert.equal(remaining(resumed, 160_000), 480_000);
  assert.equal(remaining(resumed, 10_000_000), 0);
});

// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { createPendingDelete } from "../src/pendingDelete.ts";

// A clock the test moves by hand: advance runs only the timers that are due
// by then, in order, so a timer that should have been cleared shows up.
function fakeTimer() {
  let next = 1;
  let now = 0;
  const waiting = new Map<number, { run: () => void; at: number }>();
  const advance = (ms: number) => {
    now += ms;
    const due = [...waiting].filter(([, timer]) => timer.at <= now).sort(([, a], [, b]) => a.at - b.at);
    for (const [id, timer] of due) {
      if (!waiting.delete(id)) continue;
      timer.run();
    }
  };
  return {
    set: (run: () => void, ms: number) => {
      waiting.set(next, { run, at: now + ms });
      return next++;
    },
    clear: (id: number | undefined) => {
      if (id !== undefined) waiting.delete(id);
    },
    advance,
    // Every timer, however far off.
    fire: () => advance(Infinity),
  };
}

function setup() {
  const timer = fakeTimer();
  const done: string[] = [];
  const undo = createPendingDelete(timer);
  const remove = (name: string) => undo.offer([name], `Removed ${name}`, () => void done.push(name));
  return { timer, done, undo, remove };
}

test("a removal waits, hidden, then really happens when the time is up", async () => {
  const { timer, done, undo, remove } = setup();
  remove("milk");
  assert.deepEqual(undo.current()?.ids, ["milk"]);
  assert.deepEqual(done, []);
  timer.fire();
  await Promise.resolve();
  assert.deepEqual(done, ["milk"]);
  assert.equal(undo.current(), null);
});

test("Undo brings it back, and it's never deleted", async () => {
  const { timer, done, undo, remove } = setup();
  remove("milk");
  await undo.undo();
  timer.fire();
  assert.deepEqual(done, []);
  assert.equal(undo.current(), null);
});

test("held, the bar waits; let go, it gets its full time again", async () => {
  const { timer, done, undo, remove } = setup();
  remove("milk");
  timer.advance(5000);
  undo.hold();
  timer.advance(60_000);
  await Promise.resolve();
  assert.deepEqual(done, [], "nothing deleted while held");
  undo.release();
  timer.advance(5999);
  await Promise.resolve();
  assert.deepEqual(done, [], "a full six seconds after letting go");
  timer.advance(1);
  await Promise.resolve();
  assert.deepEqual(done, ["milk"]);
});

test("letting go twice leaves no stray timer to cut the next one short", async () => {
  const { timer, done, undo, remove } = setup();
  remove("milk");
  undo.hold();
  undo.release();
  undo.release();
  timer.advance(3000);
  remove("eggs");
  await Promise.resolve();
  assert.deepEqual(done, ["milk"]);
  timer.advance(3000);
  await Promise.resolve();
  assert.deepEqual(done, ["milk"], "eggs still has 3 of its 6 seconds");
  timer.advance(3000);
  await Promise.resolve();
  assert.deepEqual(done, ["milk", "eggs"]);
});

test("another removal carries out the one waiting", async () => {
  const { done, undo, remove } = setup();
  remove("milk");
  remove("eggs");
  await Promise.resolve();
  assert.deepEqual(done, ["milk"]);
  assert.deepEqual(undo.current()?.ids, ["eggs"]);
});

test("a second removal gets its own full time for Undo", async () => {
  const { timer, done, undo, remove } = setup();
  remove("milk");
  timer.advance(4000);
  remove("eggs");
  await Promise.resolve();
  // When milk's time would have been up, eggs still waits.
  timer.advance(3000);
  await Promise.resolve();
  assert.deepEqual(done, ["milk"]);
  assert.deepEqual(undo.current()?.ids, ["eggs"]);
  timer.advance(3000);
  await Promise.resolve();
  assert.deepEqual(done, ["milk", "eggs"]);
});

test("leaving the page carries it out", async () => {
  const { timer, done, undo, remove } = setup();
  remove("milk");
  await undo.leave();
  assert.deepEqual(done, ["milk"]);
  // And not a second time when the old timer would have fired.
  timer.fire();
  assert.deepEqual(done, ["milk"]);
});

test("settle carries it out now, for a change that needs it gone first", async () => {
  const { done, undo, remove } = setup();
  remove("dinner");
  await undo.settle();
  assert.deepEqual(done, ["dinner"]);
  await undo.settle();
  assert.deepEqual(done, ["dinner"]);
});

test("whoever listens hears about each change", async () => {
  const { undo, remove } = setup();
  let changes = 0;
  const stop = undo.subscribe(() => changes++);
  remove("milk");
  await undo.undo();
  stop();
  remove("eggs");
  assert.ok(changes >= 2);
  const seen = changes;
  await undo.undo();
  assert.equal(changes, seen);
});

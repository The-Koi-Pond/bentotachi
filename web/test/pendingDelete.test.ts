// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { createPendingDelete } from "../src/pendingDelete.ts";

// A clock the test moves by hand.
function fakeTimer() {
  let next = 1;
  const waiting = new Map<number, () => void>();
  return {
    set: (run: () => void) => {
      waiting.set(next, run);
      return next++;
    },
    clear: (id: number | undefined) => {
      if (id !== undefined) waiting.delete(id);
    },
    fire: () => {
      const runs = [...waiting.values()];
      waiting.clear();
      runs.forEach((run) => run());
    },
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

test("another removal carries out the one waiting", async () => {
  const { done, undo, remove } = setup();
  remove("milk");
  remove("eggs");
  await Promise.resolve();
  assert.deepEqual(done, ["milk"]);
  assert.deepEqual(undo.current()?.ids, ["eggs"]);
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

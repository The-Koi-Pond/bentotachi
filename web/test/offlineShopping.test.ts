// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { isUnsent, queueAdd, queueCheck, sendQueued, withQueued, withoutHandled, type QueuedChange } from "../src/offlineShopping.ts";
import type { ShoppingItem } from "../src/pb.ts";

const now = new Date("2026-11-01T10:00:00Z");
const item = (id: string, text: string, checked = false) =>
  ({ id, text, checked, recipe: "", pantry_item: "", added_by: "", created: "2026-10-31 09:00:00.000Z", updated: "2026-10-31 09:00:00.000Z" }) as ShoppingItem;

test("ticks offline show straight away, one per item", () => {
  let queue = queueCheck([], "milk1", true, now);
  queue = queueCheck(queue, "milk1", false, now);
  queue = queueCheck(queue, "eggs1", true, now);
  assert.equal(queue.length, 2);
  const shown = withQueued([item("milk1", "Milk"), item("eggs1", "Eggs")], queue);
  assert.deepEqual(shown.map((i) => [i.text, i.checked]), [["Milk", false], ["Eggs", true]]);
});

test("things added offline show, and ticking them changes what's added", () => {
  let queue = queueAdd([], "Bread", now, () => 0.5);
  const id = queue[0].id;
  assert.ok(isUnsent(id));
  queue = queueCheck(queue, id, true, now);
  assert.equal(queue.length, 1);
  const shown = withQueued([item("milk1", "Milk")], queue);
  assert.deepEqual(shown.map((i) => [i.text, i.checked]), [["Milk", false], ["Bread", true]]);
});

test("a tick for something removed meanwhile is skipped", () => {
  const shown = withQueued([item("milk1", "Milk")], queueCheck([], "gone", true, now));
  assert.deepEqual(shown.map((i) => i.text), ["Milk"]);
});

const describe = (queue: QueuedChange[]) => queue.map((c) => (c.kind === "add" ? `add ${c.text}` : `check ${c.id} ${c.checked}`));

test("sending stops when offline again, and drops what the server turns down", async () => {
  const sent: string[] = [];
  let queue = queueAdd([], "Bread", now);
  queue = queueCheck(queue, "gone", true, now);
  queue = queueCheck(queue, "milk1", true, now);
  queue = queueAdd(queue, "Jam", now);
  const handled = await sendQueued(queue, {
    add: async (text) => {
      if (text === "Jam") throw { status: 0 };
      sent.push(`add ${text}`);
    },
    check: async (id) => {
      if (id === "gone") throw { status: 404 };
      sent.push(`check ${id}`);
    },
  });
  assert.deepEqual(sent, ["add Bread", "check milk1"]);
  assert.deepEqual(describe(withoutHandled(queue, handled)), ["add Jam"]);
});

test("a logged-out or failing server keeps the changes waiting", async () => {
  for (const status of [401, 403, 500, 503]) {
    let queue = queueAdd([], "Bread", now);
    queue = queueCheck(queue, "milk1", true, now);
    const handled = await sendQueued(queue, {
      add: async () => {},
      check: async () => {
        throw { status };
      },
    });
    assert.deepEqual(describe(withoutHandled(queue, handled)), ["check milk1 true"], `status ${status}`);
  }
});

test("changes made while sending aren't lost", async () => {
  let queue = queueAdd([], "Bread", now);
  queue = queueCheck(queue, "milk1", true, now);
  let current = queue;
  const handled = await sendQueued(queue, {
    add: async () => {
      // While Bread is being sent: milk ticked back off, eggs ticked, jam added.
      current = queueCheck(current, "milk1", false, now);
      current = queueCheck(current, "eggs1", true, now);
      current = queueAdd(current, "Jam", now);
    },
    check: async () => {},
  });
  assert.deepEqual(describe(withoutHandled(current, handled)), ["check milk1 false", "check eggs1 true", "add Jam"]);
});

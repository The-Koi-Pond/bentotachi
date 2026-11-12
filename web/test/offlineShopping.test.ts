// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  clearPlan,
  createQueueSender,
  isUnsent,
  mustWait,
  queueAdd,
  queueCheck,
  sendQueued,
  withQueued,
  withoutHandled,
  type QueuedChange,
} from "../src/offlineShopping.ts";
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
  let queue = queueAdd([], "Bread", now, { random: () => 0.5 });
  const id = queue[0].id;
  assert.ok(isUnsent(id));
  queue = queueCheck(queue, id, true, now);
  assert.equal(queue.length, 1);
  const shown = withQueued([item("milk1", "Milk")], queue);
  assert.deepEqual(shown.map((i) => [i.text, i.checked]), [["Milk", false], ["Bread", true]]);
});

test("something added offline remembers its list, shows on it, and is sent to it", async () => {
  const queue = queueAdd([], "Candles", now, { list: "party" });
  assert.equal(withQueued([], queue)[0].list, "party");
  const sent: string[] = [];
  await sendQueued(queue, {
    loggedIn: async () => true,
    add: async (text, _checked, _record, list) => {
      sent.push(`${text} to ${list}`);
    },
    check: async () => {},
  });
  assert.deepEqual(sent, ["Candles to party"]);
  // Queued before lists: the main one ("").
  const older = [{ kind: "add" as const, id: "offline-1-1", text: "Milk", checked: false, at: "2026-11-01 10:00:00.000Z" }];
  assert.equal(withQueued([], older)[0].list, "");
});

test("something added offline to a list deleted meanwhile goes on the main list, and says so", async () => {
  const queue = queueAdd([], "Ice", now, { list: "party" });
  const sent: string[] = [];
  const moved: string[] = [];
  const refusedList = Object.assign(new Error("list gone"), { status: 400, response: { data: { list: { code: "validation_missing_rel_records" } } } });
  const handled = await sendQueued(queue, {
    loggedIn: async () => true,
    add: async (text, _checked, _record, list) => {
      if (list === "party") throw refusedList;
      sent.push(`${text} to ${list || "main"}`);
    },
    check: async () => {},
    onMoved: (text) => moved.push(text),
  });
  assert.deepEqual(sent, ["Ice to main"]);
  assert.deepEqual(moved, ["Ice"]);
  assert.equal(handled.length, 1);
  // Any other refusal still counts as turned down, as before.
  const other = Object.assign(new Error("bad"), { status: 400, response: { data: { text: { code: "validation_required" } } } });
  const sentOther: string[] = [];
  await sendQueued(queueAdd([], "Ice", now, { list: "party" }), {
    loggedIn: async () => true,
    add: async (text, _c, _r, list) => {
      sentOther.push(list);
      throw other;
    },
    check: async () => {
      throw other;
    },
  });
  assert.deepEqual(sentOther, ["party"]);
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
    loggedIn: async () => true,
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

test("a server having trouble keeps the changes waiting", async () => {
  for (const status of [429, 500, 503]) {
    let queue = queueAdd([], "Bread", now);
    queue = queueCheck(queue, "milk1", true, now);
    const handled = await sendQueued(queue, {
      loggedIn: async () => true,
      add: async () => {},
      check: async () => {
        throw { status };
      },
    });
    assert.deepEqual(describe(withoutHandled(queue, handled)), ["check milk1 true"], `status ${status}`);
  }
});

test("nothing is sent, and nothing lost, when the login is no longer good", async () => {
  // PocketBase answers an expired login as if logged out: 400 for an add,
  // 404 for a tick (server/test/expired-login.check.mjs). Those would look
  // like "turned down for good", so the login is checked first.
  let queue = queueAdd([], "Bread", now);
  queue = queueCheck(queue, "milk1", true, now);
  const sent: string[] = [];
  const handled = await sendQueued(queue, {
    loggedIn: async () => false,
    add: async (text) => {
      sent.push(text);
      throw { status: 400 };
    },
    check: async (id) => {
      sent.push(id);
      throw { status: 404 };
    },
  });
  assert.deepEqual(sent, []);
  assert.deepEqual(describe(withoutHandled(queue, handled)), ["add Bread", "check milk1 true"]);
});

test("a change the server turns down is dropped, and the rest still go", async () => {
  let queue = queueCheck([], "gone", true, now);
  queue = queueAdd(queue, "Bread", now);
  const sent: string[] = [];
  const handled = await sendQueued(queue, {
    loggedIn: async () => true,
    add: async (text) => {
      sent.push(text);
    },
    check: async () => {
      throw { status: 400 };
    },
  });
  assert.deepEqual(sent, ["Bread"]);
  assert.deepEqual(withoutHandled(queue, handled), []);
});

test("one that can't go yet holds back the ones after it, in order", async () => {
  let queue = queueAdd([], "Bread", now);
  queue = queueAdd(queue, "Jam", now);
  queue = queueAdd(queue, "Tea", now);
  const sent: string[] = [];
  const handled = await sendQueued(queue, {
    loggedIn: async () => true,
    add: async (text) => {
      if (text === "Jam") throw { status: 503 };
      sent.push(text);
    },
    check: async () => {},
  });
  assert.deepEqual(sent, ["Bread"]);
  assert.deepEqual(describe(withoutHandled(queue, handled)), ["add Jam", "add Tea"]);
});

test("while sending, taps wait for items with changes on their way", () => {
  let queue = queueAdd([], "Bread", now);
  const bread = queue[0].id;
  queue = queueCheck(queue, "milk1", true, now);
  assert.equal(mustWait(true, queue, bread), true);
  assert.equal(mustWait(true, queue, "milk1"), true);
  assert.equal(mustWait(true, queue, "eggs1"), false);
  assert.equal(mustWait(false, queue, "milk1"), false);
  assert.equal(mustWait(false, queue, bread), false);
});

test("only one send at a time, however many copies of the page ask", async () => {
  let store = queueAdd(queueAdd([], "Bread", now), "Jam", now);
  const sender = createQueueSender(
    () => store,
    (update) => (store = update(store))
  );
  const sent: string[] = [];
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const send = {
    loggedIn: async () => true,
    add: async (text: string) => {
      await gate;
      sent.push(text);
    },
    check: async () => {},
  };
  // The page is left and opened again while the first send runs.
  const first = sender.send(send);
  assert.equal(sender.isSending(), true);
  const second = await sender.send(send);
  assert.equal(second, null);
  release();
  assert.deepEqual(await first, { handled: 2, total: 2 });
  assert.deepEqual(sent, ["Bread", "Jam"]);
  assert.deepEqual(store, []);
  assert.equal(sender.isSending(), false);
});

test("an add whose answer was lost (it did reach the server) isn't added twice", async () => {
  // The server: refuses a second record with an id it has (as PocketBase
  // does, 400), and this once saves it but the answer never arrives.
  const saved = new Map<string, string>();
  let loseAnswer = true;
  const send = {
    loggedIn: async () => true,
    add: async (text: string, _checked: boolean, record: string) => {
      if (saved.has(record)) throw { status: 400 };
      saved.set(record, text);
      if (loseAnswer) {
        loseAnswer = false;
        throw { status: 0 };
      }
    },
    check: async () => {},
  };
  let queue = queueAdd([], "Milk", now);
  const lost = await sendQueued(queue, send);
  assert.equal(lost.length, 0, "looked offline: still waiting");
  const again = await sendQueued(queue, send);
  queue = withoutHandled(queue, again);
  assert.deepEqual([...saved.values()], ["Milk"]);
  assert.deepEqual(queue, []);
});

test("an add whose answer was lost, ticked or unticked while it waited, ends that way on the server", async () => {
  const saved = new Map<string, boolean>();
  let loseAnswer = true;
  const send = {
    loggedIn: async () => true,
    add: async (_text: string, checked: boolean, record: string) => {
      if (saved.has(record)) throw { status: 400 };
      saved.set(record, checked);
      if (loseAnswer) {
        loseAnswer = false;
        throw { status: 0 };
      }
    },
    check: async (id: string, checked: boolean) => void saved.set(id, checked),
  };
  let queue = queueAdd([], "Butter", now);
  await sendQueued(queue, send);
  // In the trolley before the signal came back.
  queue = queueCheck(queue, queue[0].id, true, now);
  queue = withoutHandled(queue, await sendQueued(queue, send));
  assert.deepEqual([...saved.values()], [true]);
  assert.deepEqual(queue, []);

  // And the other way: it reached the server ticked, then was unticked.
  saved.clear();
  loseAnswer = true;
  queue = queueAdd([], "Jam", now);
  queue = queueCheck(queue, queue[0].id, true, now);
  await sendQueued(queue, send);
  queue = queueCheck(queue, queue[0].id, false, now);
  queue = withoutHandled(queue, await sendQueued(queue, send));
  assert.deepEqual([...saved.values()], [false]);
  assert.deepEqual(queue, []);
});

test("an add already on the server whose tick can't go yet stays waiting, with the ones after it", async () => {
  let queue = queueAdd([], "Butter", now);
  queue = queueCheck(queue, queue[0].id, true, now);
  queue = queueCheck(queue, "milk1", true, now);
  const sent: string[] = [];
  const handled = await sendQueued(queue, {
    loggedIn: async () => true,
    // Already there (its first answer was lost)...
    add: async () => {
      throw { status: 400 };
    },
    // ...and the signal drops before its tick goes.
    check: async (id) => {
      sent.push(id);
      throw { status: 0 };
    },
  });
  assert.equal(sent.length, 1, "its tick was tried, and milk1's wasn't");
  assert.deepEqual(describe(withoutHandled(queue, handled)), ["add Butter", "check milk1 true"]);
});

test("two tabs sharing the queue: the second sends only what the first didn't", async () => {
  // The phone's storage, shared; each tab reads it again only when it
  // changed (as shoppingQueue.ts does), so a tab gets its own copies.
  type Queue = ReturnType<typeof queueAdd>;
  let saved = JSON.stringify(queueAdd(queueAdd([], "Bread", now), "Jam", now));
  const tab = () => {
    let seen = "";
    let copy: Queue = [];
    const get = () => {
      if (saved !== seen) [seen, copy] = [saved, JSON.parse(saved) as Queue];
      return copy;
    };
    const set = (update: (queue: Queue) => Queue) => (saved = JSON.stringify(update(get())));
    return { get, set };
  };
  // The browser's lock across tabs, as a plain one-at-a-time chain.
  let chain: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(run: () => Promise<T>): Promise<T> => {
    const next = chain.then(run);
    chain = next.catch(() => {});
    return next;
  };
  const sent: string[] = [];
  const send = { loggedIn: async () => true, add: async (text: string) => void sent.push(text), check: async () => {} };
  const a = tab();
  const b = tab();
  const [fromA, fromB] = await Promise.all([createQueueSender(a.get, a.set, exclusive).send(send), createQueueSender(b.get, b.set, exclusive).send(send)]);
  assert.deepEqual(sent, ["Bread", "Jam"]);
  assert.deepEqual(fromA, { handled: 2, total: 2 });
  assert.equal(fromB, null);
  assert.deepEqual(b.get(), []);
});

test("clearing ticked things: ones added offline just leave the queue, and it waits while sending", () => {
  let queue = queueAdd([], "Bread", now);
  const bread = queue[0].id;
  queue = queueCheck(queue, bread, true, now);
  const ticked = [{ id: bread }, { id: "milk1" }];
  assert.deepEqual(clearPlan(false, queue, ticked), { wait: false, unsent: [bread], sent: ["milk1"] });
  assert.equal(clearPlan(true, queue, ticked).wait, true);
  assert.equal(clearPlan(true, queue, [{ id: "milk1" }]).wait, false);
});

test("what was sent leaves the queue even when it's been read again as new copies (another tab wrote it)", () => {
  let queue = queueAdd([], "Bread", now);
  queue = queueCheck(queue, "milk1", true, now);
  const handled = [...queue];
  // Another tab added Jam meanwhile: this tab reads the queue fresh.
  const reread = JSON.parse(JSON.stringify(queueAdd(queue, "Jam", new Date("2026-11-01T10:00:05Z")))) as QueuedChange[];
  assert.deepEqual(describe(withoutHandled(reread, handled)), ["add Jam"]);
});

test("changes made while sending aren't lost", async () => {
  let queue = queueAdd([], "Bread", now);
  queue = queueCheck(queue, "milk1", true, now);
  let current = queue;
  const handled = await sendQueued(queue, {
    loggedIn: async () => true,
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

// The sender itself, not just its helpers: the signal drops again partway,
// and something is added offline meanwhile. Only what was sent may leave
// the queue (a slip like keeping the queue from before the send, or
// emptying it, would lose Jam or Tea; found by the 2026-11-02 audit).
test("a send cut off partway keeps the rest, and changes made meanwhile", async () => {
  let store = queueAdd(queueAdd([], "Bread", now), "Jam", now);
  const sender = createQueueSender(
    () => store,
    (update) => (store = update(store))
  );
  const result = await sender.send({
    loggedIn: async () => true,
    add: async (text: string) => {
      if (text === "Bread") return;
      // While Jam is on its way: the phone notices it's offline, Tea is
      // added offline, and Jam's send fails for want of a connection.
      store = queueAdd(store, "Tea", now);
      throw { status: 0 };
    },
    check: async () => {},
  });
  assert.deepEqual(result, { handled: 1, total: 2 });
  assert.deepEqual(describe(store), ["add Jam", "add Tea"]);
});

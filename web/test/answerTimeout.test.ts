import assert from "node:assert/strict";
import { test } from "node:test";
import { answerInTime, needsQuickAnswer } from "../src/answerTimeout.ts";

// A stand-in for fetch: answers after `delay` ms, or fails when aborted first.
function server(delay: number): typeof fetch {
  return (_input, init) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response("{}", { headers: { "content-type": "application/json" } })), delay);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
}

test("an answer that starts in time comes through", async () => {
  const answer = await answerInTime(server(5), 200)("http://pi/api/collections/recipes/records");
  assert.equal(answer.status, 200);
});

test("no answer in time is given up on, as an abort", async () => {
  await assert.rejects(answerInTime(server(500), 20)("http://pi/api/collections/recipes/records"), { name: "AbortError" });
});

// A real fetch reads the rest of a long list after the answer starts, and
// aborting its signal then would cut the list off (status 0: the copy
// shows while the server is fine).
test("once the answer has started, its signal is never aborted", async () => {
  let seen: AbortSignal | undefined;
  const send: typeof fetch = async (_input, init) => {
    seen = init?.signal ?? undefined;
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  await answerInTime(send, 30)("http://pi/api/collections/recipes/records");
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(seen?.aborted, false);
});

test("the caller's own signal still cancels it", async () => {
  const mine = new AbortController();
  const sent = answerInTime(server(500), 1000)("http://pi/x", { signal: mine.signal });
  mine.abort();
  await assert.rejects(sent, { name: "AbortError" });
});

const PI = "http://pi:8090";

test("loading, the login renewal and the health check get the limit", () => {
  assert.equal(needsQuickAnswer(`${PI}/api/collections/recipes/records`, "GET", undefined), true);
  assert.equal(needsQuickAnswer(`${PI}/api/collections/recipes/records/abc123`, "get", undefined), true);
  assert.equal(needsQuickAnswer(`${PI}/api/collections/users/auth-refresh`, "POST", "{}"), true);
  assert.equal(needsQuickAnswer(`${PI}/api/health`, "GET", undefined), true, "the connection indicator's check");
});

test("a save waits as long as it takes, so one made but answered late isn't taken back", () => {
  assert.equal(needsQuickAnswer(`${PI}/api/collections/pantry_items/records/abc123`, "PATCH", {}), false, "marking Out");
  assert.equal(needsQuickAnswer(`${PI}/api/collections/meal_plan/records`, "POST", {}), false);
  assert.equal(needsQuickAnswer(`${PI}/api/collections/notes/records/abc123`, "DELETE", undefined), false);
});

test("except shopping list changes, sent again safely, and any save once the server is known to be away", () => {
  assert.equal(needsQuickAnswer(`${PI}/api/collections/shopping_items/records/abc123`, "PATCH", {}), true);
  assert.equal(needsQuickAnswer(`${PI}/api/collections/shopping_items/records`, "POST", { id: "abcdefghijklmno", text: "Milk" }), true);
  assert.equal(
    needsQuickAnswer(`${PI}/api/collections/shopping_items/records`, "POST", { text: "Milk", pantry_item: "x" }),
    false,
    "the pantry's add to list has no id of its own: a second try would add it twice"
  );
  assert.equal(needsQuickAnswer(`${PI}/api/collections/shopping_items/records/abc123`, "DELETE", undefined), true);
  assert.equal(needsQuickAnswer(`${PI}/api/collections/pantry_items/records/abc123`, "PATCH", {}, { down: true }), true);
});

test("never an upload, nor the server's slower routes", () => {
  assert.equal(needsQuickAnswer(`${PI}/api/collections/recipes/records`, "POST", new FormData(), { down: true }), false);
  assert.equal(needsQuickAnswer(`${PI}/api/cookbook/import`, "POST", "{}"), false);
  assert.equal(needsQuickAnswer(`${PI}/api/cookbook/barcode/123`, "GET", undefined), false);
  assert.equal(needsQuickAnswer(`${PI}/api/realtime`, "POST", "{}"), false);
});

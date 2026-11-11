// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { createConnection, heardWhen, requestFetch, watched } from "../src/connection.ts";

function setup(saved: number | null = null) {
  let time = 1_000_000;
  const saves: number[] = [];
  let backs = 0;
  const connection = createConnection({
    now: () => time,
    saved: () => saved,
    save: (at) => saves.push(at),
    onBack: () => backs++,
  });
  return {
    connection,
    saves,
    backs: () => backs,
    pass: (ms: number) => {
      time += ms;
    },
    now: () => time,
  };
}

test("unknown until the first request, then follows how they go", () => {
  const { connection } = setup();
  assert.equal(connection.get().reachable, null);
  connection.answered();
  assert.equal(connection.get().reachable, true);
  connection.unreachable();
  assert.equal(connection.get().reachable, false);
});

test("going down shows when the server last answered, and keeps it on the phone", () => {
  const { connection, saves, pass } = setup();
  connection.answered();
  pass(5_000);
  connection.answered();
  pass(20_000);
  connection.unreachable();
  assert.equal(connection.get().lastReached, 1_005_000, "the last answer, not when it went down");
  assert.deepEqual(saves, [1_000_000, 1_005_000], "saved at most each half minute, and on going down");
});

test("opened offline, the time saved last time shows", () => {
  const { connection } = setup(42);
  connection.unreachable();
  assert.equal(connection.get().lastReached, 42);
});

test("coming back tells the lists once; staying up doesn't", () => {
  const { connection, backs } = setup();
  connection.answered();
  connection.answered();
  assert.equal(backs(), 0, "first answer after opening isn't a comeback");
  connection.unreachable();
  connection.answered();
  connection.answered();
  assert.equal(backs(), 1);
});

test("a request that hung while the server was away doesn't undo its comeback", () => {
  const { connection, pass, now } = setup();
  connection.unreachable();
  const sentWhileAway = now();
  pass(3_000);
  connection.answered();
  pass(5_000);
  connection.unreachable(sentWhileAway);
  assert.equal(connection.get().reachable, true);
  connection.unreachable();
  assert.equal(connection.get().reachable, false, "a failure sent after the answer still counts");
});

test("watched: the server's answer, anything else answering, no answer, and a page cancelling", async () => {
  const { connection } = setup();
  const json = () => Promise.resolve(new Response("{}", { headers: { "content-type": "application/json" } }));
  const html = () => Promise.resolve(new Response("<html>Sign in to Café Wi-Fi</html>", { headers: { "content-type": "text/html" } }));
  const fails = () => Promise.reject(new TypeError("Failed to fetch"));

  await watched(json, connection)("http://pi/api/health");
  assert.equal(connection.get().reachable, true);
  await watched(html, connection)("http://pi/api/health");
  assert.equal(connection.get().reachable, false, "a sign-in page isn't the server");
  await watched(json, connection)("http://pi/api/health");
  await assert.rejects(watched(fails, connection)("http://pi/api/health"));
  assert.equal(connection.get().reachable, false);

  await watched(json, connection)("http://pi/api/health");
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(watched(fails, connection)("http://pi/x", { signal: cancelled.signal }));
  assert.equal(connection.get().reachable, true, "the page cancelling isn't the server's fault");
});

test("watched passes when the request went, so a late failure doesn't undo a comeback", async () => {
  let time = 0;
  const connection = createConnection({ now: () => time, saved: () => null, save: () => {} });
  connection.unreachable();
  let fail!: (err: unknown) => void;
  const hanging = watched(() => new Promise((_resolve, reject) => (fail = reject)), connection)("http://pi/api/health");
  time = 1000;
  await watched(() => Promise.resolve(new Response("{}", { headers: { "content-type": "application/json" } })), connection)("http://pi/api/health");
  time = 9000;
  fail(new TypeError("Failed to fetch"));
  await assert.rejects(hanging);
  assert.equal(connection.get().reachable, true);
});

test("the server refusing (a JSON 404) is still the server answering", async () => {
  const { connection } = setup();
  const refused = () => Promise.resolve(new Response('{"status":404}', { status: 404, headers: { "content-type": "application/json" } }));
  await watched(refused, connection)("http://pi/x");
  assert.equal(connection.get().reachable, true);
});

test("the time is saved at most each half minute while answers keep coming", () => {
  const { connection, saves, pass } = setup();
  connection.answered();
  pass(10_000);
  connection.answered();
  pass(10_000);
  connection.answered();
  assert.deepEqual(saves, [1_000_000]);
  pass(15_000);
  connection.answered();
  assert.deepEqual(saves, [1_000_000, 1_035_000]);
});

test("subscribers hear it going down and coming back", () => {
  const { connection } = setup();
  let heard = 0;
  connection.subscribe(() => heard++);
  connection.unreachable();
  connection.answered();
  assert.equal(heard, 2);
});

// A stand-in timer: what's running, and a way to fire it.
function timers() {
  const running = new Set<() => void>();
  return {
    every: (run: () => void) => {
      running.add(run);
      return () => running.delete(run);
    },
    running,
    fire: () => Promise.all([...running].map((run) => run())),
  };
}

test("while it's down the server is checked every half minute, and no more once it answers", async () => {
  const clock = timers();
  let backs = 0;
  let serverUp = false;
  const connection = createConnection({ saved: () => null, save: () => {}, every: clock.every, onBack: () => backs++ });
  connection.setCheck(async () => {
    if (!serverUp) throw new TypeError("Failed to fetch");
    connection.answered();
  });
  assert.equal(clock.running.size, 0, "nothing runs while all's well");
  connection.unreachable();
  connection.unreachable();
  assert.equal(clock.running.size, 1, "one check, however many failures");
  await clock.fire();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(connection.get().reachable, false);
  serverUp = true;
  await clock.fire();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(connection.get().reachable, true);
  assert.equal(backs, 1, "the lists reload");
  assert.equal(clock.running.size, 0, "and the checking stops");
});

test("the check starts again on a second outage", () => {
  const clock = timers();
  const connection = createConnection({ saved: () => null, save: () => {}, every: clock.every });
  connection.unreachable();
  connection.answered();
  assert.equal(clock.running.size, 0);
  connection.unreachable();
  assert.equal(clock.running.size, 1);
});

test("Try again that reaches the server reloads the lists once", async () => {
  let backs = 0;
  const connection = createConnection({ saved: () => null, save: () => {}, onBack: () => backs++ });
  connection.setCheck(async () => connection.answered());
  connection.unreachable();
  await connection.checkNow();
  assert.equal(backs, 1, "by coming back, not again on top");
  await connection.checkNow();
  assert.equal(backs, 2, "never down, but a page asked: it still reloads");
});

test("Try again that still can't reach it reloads nothing", async () => {
  let backs = 0;
  const connection = createConnection({ saved: () => null, save: () => {}, onBack: () => backs++ });
  connection.setCheck(async () => {
    throw new TypeError("Failed to fetch");
  });
  connection.unreachable();
  await connection.checkNow();
  assert.equal(backs, 0);
});

// What pb.ts sends every request with: the time limit inside, the watching
// outside, so a request given up on counts as no answer (not as the page
// cancelling it).
test("requestFetch: given up on after the limit, it counts as unreachable", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { connection } = setup();
  const hangs: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const sent = requestFetch("http://pi/api/collections/recipes/records", { method: "GET", fetch: hangs }, connection)(
    "http://pi/api/collections/recipes/records",
    {}
  );
  t.mock.timers.tick(8_000);
  await assert.rejects(sent, { name: "AbortError" });
  assert.equal(connection.get().reachable, false);
});

test("requestFetch: a save isn't given up on while the server answers", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { connection } = setup();
  connection.answered();
  let signal: AbortSignal | undefined;
  const slow: typeof fetch = (_input, init) => {
    signal = init?.signal ?? undefined;
    return new Promise(() => {});
  };
  void requestFetch("http://pi/api/collections/pantry_items/records/abc", { method: "PATCH", fetch: slow }, connection)(
    "http://pi/api/collections/pantry_items/records/abc",
    {}
  );
  t.mock.timers.tick(60_000);
  assert.equal(signal?.aborted ?? false, false);
});

test("requestFetch: a save once the server is known to be away goes back after the limit", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { connection } = setup();
  connection.unreachable();
  const hangs: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const url = "http://pi/api/collections/pantry_items/records/abc";
  const sent = requestFetch(url, { method: "PATCH", fetch: hangs }, connection)(url, {});
  t.mock.timers.tick(8_000);
  await assert.rejects(sent, { name: "AbortError" });
});

test("heardWhen: the time today or yesterday, then how long ago", () => {
  const now = new Date(2026, 10, 11, 18, 0);
  assert.match(heardWhen(new Date(2026, 10, 11, 14, 14).getTime(), now), /^today at 2:14\s?pm$/);
  assert.match(heardWhen(new Date(2026, 10, 10, 9, 5).getTime(), now), /^yesterday at 9:05\s?am$/);
  assert.equal(heardWhen(new Date(2026, 10, 6, 9, 5).getTime(), now), "5 days ago");
});

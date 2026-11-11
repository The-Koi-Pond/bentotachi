// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { createLoginGuard, isServerAnswer, isServerRefusal, type LoginState } from "../src/loginGuard.ts";

test("only JSON or an empty 'done' is the server answering; a Wi-Fi sign-in page isn't", () => {
  assert.equal(isServerAnswer(200, "application/json; charset=utf-8", "120"), true);
  assert.equal(isServerAnswer(400, "application/json", null), true, "its refusals are JSON too");
  assert.equal(isServerAnswer(204, null, null), true, "a delete, or the live updates' subscription");
  assert.equal(isServerAnswer(200, null, "0"), true);
  assert.equal(isServerAnswer(200, "text/html; charset=utf-8", "5120"), false, "a sign-in page saying OK");
  assert.equal(isServerAnswer(403, "text/html", null), false, "a 'forbidden' page");
  assert.equal(isServerAnswer(200, null, null), false, "something with a body but no type");
});

test("only PocketBase's own refusal signs out, not a public Wi-Fi's page", () => {
  // PocketBase's answer: its JSON names the status.
  assert.equal(isServerRefusal({ status: 401, response: { status: 401, message: "The request requires valid record authorization token.", data: {} } }), true);
  assert.equal(isServerRefusal({ status: 403, response: { status: 403, message: "Forbidden.", data: {} } }), true);
  // A captive portal's HTML "forbidden" page: the client has no JSON to show.
  assert.equal(isServerRefusal({ status: 403, response: {} }), false);
  assert.equal(isServerRefusal({ status: 401 }), false);
  // Offline, or the server in trouble.
  assert.equal(isServerRefusal({ status: 0, response: {} }), false);
  assert.equal(isServerRefusal({ status: 500, response: { status: 500 } }), false);
  assert.equal(isServerRefusal(null), false);
});

function setup(answers: LoginState[]) {
  let time = 0;
  let calls = 0;
  const guard = createLoginGuard(
    async () => {
      calls += 1;
      return answers.shift() ?? "ok";
    },
    () => time,
    60_000
  );
  return { guard, calls: () => calls, wait: (ms: number) => (time += ms) };
}

test("one renewal at a time, shared by everyone asking", async () => {
  const { guard, calls } = setup(["ok"]);
  const states = await Promise.all([guard.ensure(), guard.ensure(), guard.ensure()]);
  assert.deepEqual(states, ["ok", "ok", "ok"]);
  assert.equal(calls(), 1);
});

test("a confirmed login isn't asked about again for a while", async () => {
  const { guard, calls, wait } = setup(["ok", "ok"]);
  await guard.ensure();
  wait(59_000);
  assert.equal(await guard.ensure(), "ok");
  assert.equal(calls(), 1);
  wait(2_000);
  await guard.ensure();
  assert.equal(calls(), 2);
});

test("a login that couldn't be confirmed is asked about again next time", async () => {
  const { guard, calls } = setup(["offline", "unknown", "signedOut", "ok"]);
  assert.equal(await guard.ensure(), "offline");
  assert.equal(await guard.ensure(), "unknown");
  assert.equal(await guard.ensure(), "signedOut");
  assert.equal(await guard.ensure(), "ok");
  assert.equal(calls(), 4);
});

test("before changing anything, the login is always checked fresh", async () => {
  // Sending changes made offline: a login revoked a moment ago (a password
  // changed on another phone) would make them look refused and lose them.
  const { guard, calls } = setup(["ok", "signedOut"]);
  await guard.ensure();
  assert.equal(await guard.ensure(0), "signedOut");
  assert.equal(calls(), 2);
});

test("logging in or out starts over", async () => {
  const { guard, calls } = setup(["ok", "ok"]);
  await guard.ensure();
  guard.forget();
  await guard.ensure();
  assert.equal(calls(), 2);
});

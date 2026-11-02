// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { createLoginGuard, type LoginState } from "../src/loginGuard.ts";

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
  const { guard, calls } = setup(["unknown", "signedOut", "ok"]);
  assert.equal(await guard.ensure(), "unknown");
  assert.equal(await guard.ensure(), "signedOut");
  assert.equal(await guard.ensure(), "ok");
  assert.equal(calls(), 3);
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

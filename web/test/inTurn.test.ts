// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { inTurn } from "../src/inTurn.ts";

test("two read-then-save jobs at once run in turn, so the second sees the first's save", async () => {
  let saved: string[] = [];
  // The server reads what's saved, and the answer takes a moment to arrive.
  const read = async () => {
    const now = [...saved];
    await new Promise((resolve) => setTimeout(resolve, 5));
    return now;
  };
  const turn = inTurn();
  const add = (name: string) =>
    turn(async () => {
      const now = await read();
      saved = [...now, name];
    });
  await Promise.all([add("onion"), add("rice")]);
  assert.deepEqual(saved, ["onion", "rice"]);
});

test("a failed job is the caller's to see, and the next one still runs", async () => {
  const turn = inTurn();
  const failing = turn(async () => {
    throw new Error("offline");
  });
  const next = turn(async () => "saved");
  await assert.rejects(failing, /offline/);
  assert.equal(await next, "saved");
});

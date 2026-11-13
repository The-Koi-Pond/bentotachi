import { test } from "node:test";
import assert from "node:assert/strict";
import { moved, upDownMoves } from "../src/listOrder.ts";

test("one thing moves to where another is, the rest make room", () => {
  assert.deepEqual(moved(["Fridge", "Freezer", "Cupboard", "Chest freezer"], 3, 1), ["Fridge", "Chest freezer", "Freezer", "Cupboard"]);
  assert.deepEqual(moved(["Fridge", "Freezer", "Cupboard"], 0, 2), ["Freezer", "Cupboard", "Fridge"]);
});

test("nowhere to move: the same list", () => {
  const list = ["Fridge", "Freezer"];
  assert.equal(moved(list, 1, 1), list);
  assert.equal(moved(list, -1, 0), list);
  assert.equal(moved(list, 0, 5), list);
});

test("Move up and Move down go to the one before and after", () => {
  const keys = ["Fridge", "Freezer", "Cupboard"];
  // Where each move sends it, or "off" when it's greyed out.
  const targets = (key: string) => {
    const sent: string[] = [];
    return upDownMoves(keys, key, (to) => sent.push(to)).map((move) => {
      if (move.disabled) return `${move.label}: off`;
      move.run();
      return `${move.label}: ${sent.pop()}`;
    });
  };
  assert.deepEqual(targets("Freezer"), ["Move up: Fridge", "Move down: Cupboard"]);
  assert.deepEqual(targets("Fridge"), ["Move up: off", "Move down: Freezer"], "the first can't go up");
  assert.deepEqual(targets("Cupboard"), ["Move up: Freezer", "Move down: off"], "the last can't go down");
  assert.deepEqual(targets("Pantry"), ["Move up: off", "Move down: off"]);
  // Moving onto a neighbour swaps the two, as a drag would.
  const index = (key: string) => keys.indexOf(key);
  assert.deepEqual(moved(keys, index("Freezer"), index("Cupboard")), ["Fridge", "Cupboard", "Freezer"]);
  assert.deepEqual(moved(keys, index("Freezer"), index("Fridge")), ["Freezer", "Fridge", "Cupboard"]);
});

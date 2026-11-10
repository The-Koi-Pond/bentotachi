import { test } from "node:test";
import assert from "node:assert/strict";
import { moved } from "../src/listOrder.ts";

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

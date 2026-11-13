// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { menuStep } from "../src/menuKeys.ts";

test("down and up move one item, wrapping round the ends", () => {
  assert.equal(menuStep("ArrowDown", 0, 3), 1);
  assert.equal(menuStep("ArrowDown", 2, 3), 0);
  assert.equal(menuStep("ArrowUp", 1, 3), 0);
  assert.equal(menuStep("ArrowUp", 0, 3), 2);
});

test("with no item focused yet, down goes to the first and up to the last", () => {
  assert.equal(menuStep("ArrowDown", -1, 3), 0);
  assert.equal(menuStep("ArrowUp", -1, 3), 2);
});

test("Home and End go to the ends; other keys and empty menus aren't moves", () => {
  assert.equal(menuStep("Home", 2, 3), 0);
  assert.equal(menuStep("End", 0, 3), 2);
  assert.equal(menuStep("Enter", 0, 3), null);
  assert.equal(menuStep("Tab", 0, 3), null);
  assert.equal(menuStep("ArrowDown", -1, 0), null);
});

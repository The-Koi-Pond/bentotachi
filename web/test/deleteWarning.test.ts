// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { alsoDeleted, deleteQuestion } from "../src/deleteWarning.ts";

test("asks about one recipe by name, and several by count and name", () => {
  const none = { planned: 0, cooked: 0, ratings: 0 };
  assert.equal(deleteQuestion(["Pancakes"], none, " for everyone"), "Delete “Pancakes” for everyone? This can't be undone.");
  assert.equal(deleteQuestion(["Pancakes", "Tacos"], none, ""), "Delete these 2 recipes (“Pancakes” and “Tacos”)? This can't be undone.");
  assert.equal(
    deleteQuestion(["Pancakes", "Tacos", "Soup"], { planned: 2, cooked: 0, ratings: 1 }, ""),
    "Delete these 3 recipes (“Pancakes”, “Tacos” and “Soup”)? Their 2 nights on the dinner plan and 1 rating will be deleted too. This can't be undone.",
  );
  // More than five: the first four, then how many more.
  assert.equal(
    deleteQuestion(["A", "B", "C", "D", "E", "F", "G"], none, ""),
    "Delete these 7 recipes (“A”, “B”, “C”, “D” and 3 more)? This can't be undone.",
  );
  // Couldn't count what else goes: still warns it can't be undone.
  assert.equal(deleteQuestion(["Pancakes"], null, ""), "Delete “Pancakes”? This can't be undone.");
});

test("says what else a recipe delete removes", () => {
  assert.equal(alsoDeleted({ planned: 0, cooked: 0, ratings: 0 }), "");
  assert.equal(alsoDeleted({ planned: 1, cooked: 0, ratings: 0 }), "Its 1 night on the dinner plan will be deleted too.");
  assert.equal(alsoDeleted({ planned: 0, cooked: 2, ratings: 3 }), "Its 2 “We cooked this” days and 3 ratings will be deleted too.");
  assert.equal(
    alsoDeleted({ planned: 2, cooked: 1, ratings: 1 }),
    "Its 2 nights on the dinner plan, 1 “We cooked this” day and 1 rating will be deleted too.",
  );
});

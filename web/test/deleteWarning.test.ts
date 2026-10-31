// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { alsoDeleted } from "../src/deleteWarning.ts";

test("says what else a recipe delete removes", () => {
  assert.equal(alsoDeleted({ planned: 0, cooked: 0, ratings: 0 }), "");
  assert.equal(alsoDeleted({ planned: 1, cooked: 0, ratings: 0 }), "Its 1 night on the dinner plan will be deleted too.");
  assert.equal(alsoDeleted({ planned: 0, cooked: 2, ratings: 3 }), "Its 2 “We cooked this” days and 3 ratings will be deleted too.");
  assert.equal(
    alsoDeleted({ planned: 2, cooked: 1, ratings: 1 }),
    "Its 2 nights on the dinner plan, 1 “We cooked this” day and 1 rating will be deleted too.",
  );
});

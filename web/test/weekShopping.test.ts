// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { gatherIngredients, startsTicked } from "../src/weekShopping.ts";

const item = (id: string, name: string, status: string) => ({ id, name, status }) as never;
const pantry = [item("onion", "Onion", "have"), item("eggs", "Eggs", "low"), item("rice", "Rice", "out")];
const recipe = (id: string, title: string, ingredients: string[], links: Record<string, string> | null = null) =>
  ({ id, title, ingredients, ingredient_links: links }) as never;

test("merges lines linked to the same pantry item, across recipes", () => {
  const rows = gatherIngredients(
    [
      recipe("a", "Curry", ["# Base", "2 onions, diced", "1 cup rice", "water"], { water: "" }),
      recipe("b", "Oyakodon", ["1 onion, sliced", "3 eggs", "Dashi"]),
    ],
    pantry
  );
  assert.deepEqual(
    rows.map((r) => [r.text, r.recipeTitles.join(" + "), r.recipeId]),
    [
      ["Onion", "Curry + Oyakodon", "a"],
      ["Rice", "Curry", "a"],
      ["Eggs", "Oyakodon", "b"],
      ["Dashi", "Oyakodon", "b"],
    ]
  );
});

test("the same recipe twice in a week is named once", () => {
  const curry = recipe("a", "Curry", ["2 onions"]);
  const rows = gatherIngredients([curry, curry], pantry);
  assert.deepEqual(rows[0].recipeTitles, ["Curry"]);
});

test("unlinked lines merge only when the wording matches", () => {
  const rows = gatherIngredients([recipe("a", "A", ["Dashi"]), recipe("b", "B", ["dashi ", "2 tsp dashi"])], pantry);
  assert.deepEqual(rows.map((r) => r.text), ["Dashi", "2 tsp dashi"]);
});

test("starts with everything ticked except what we have", () => {
  const rows = gatherIngredients([recipe("a", "A", ["onion", "eggs", "rice", "dashi"])], pantry);
  assert.deepEqual(rows.map((r) => [r.text, startsTicked(r)]), [
    ["Onion", false],
    ["Eggs", true],
    ["Rice", true],
    ["dashi", true],
  ]);
});

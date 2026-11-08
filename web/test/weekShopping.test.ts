// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { gatherIngredients, linesToBuy, listWording, startsTicked } from "../src/weekShopping.ts";

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
      // Two recipes, different words: the pantry's name.
      ["Onion", "Curry + Oyakodon", "a"],
      // One recipe: its own words.
      ["1 cup rice", "Curry", "a"],
      ["3 eggs", "Oyakodon", "b"],
      ["Dashi", "Oyakodon", "b"],
    ]
  );
});

test("the list says what the recipe needs, without how to prepare it", () => {
  assert.equal(listWording("12 oz gluten free linguine pasta"), "12 oz gluten free linguine pasta");
  assert.equal(listWording("2 onions, diced"), "2 onions");
  assert.equal(listWording("Feta and coriander, to serve"), "Feta and coriander");
  assert.equal(listWording("2 tsp *soft* dashi, toasted"), "2 tsp soft dashi");
  // A decimal comma isn't a cut.
  assert.equal(listWording("1,5 kg flour"), "1,5 kg flour");
  // Several preparation parts all go; only from the end.
  assert.equal(listWording("1 onion, peeled, finely diced"), "1 onion");
  assert.equal(listWording("Onions, carrots and celery, chopped"), "Onions, carrots and celery");
});

test("nothing to buy is cut off: lists of things, and commas in brackets", () => {
  assert.equal(listWording("Salt, pepper"), "Salt, pepper");
  assert.equal(listWording("2 carrots, 2 celery sticks, 1 onion"), "2 carrots, 2 celery sticks, 1 onion");
  assert.equal(listWording("1 cup chopped walnuts, pecans, or almonds"), "1 cup chopped walnuts, pecans, or almonds");
  assert.equal(listWording("1 cup (2 sticks, 226 g) unsalted butter, softened"), "1 cup (2 sticks, 226 g) unsalted butter");
  assert.equal(listWording("1 can (14.5 oz, drained) tomatoes"), "1 can (14.5 oz, drained) tomatoes");
});

test("the plan's sheet uses the list's wording too", () => {
  const rows = gatherIngredients([recipe("a", "Tacos", ["1 lime, juiced", "2 tsp dashi, toasted"])], pantry);
  assert.deepEqual(rows.map((r) => r.text), ["1 lime", "2 tsp dashi"]);
});

test("the same recipe twice in a week is named once, by the pantry's name", () => {
  const curry = recipe("a", "Curry", ["2 onions"]);
  const rows = gatherIngredients([curry, curry], pantry);
  assert.deepEqual(rows[0].recipeTitles, ["Curry"]);
  // Twice "2 onions" is 4: not one line's amount.
  assert.equal(rows[0].text, "Onion");
});

test("a recipe's lines sharing a pantry item go on the list once, by its name", () => {
  const butter = item("butter", "Butter", "low");
  const things = linesToBuy([
    { text: "2 tbsp butter, softened", pantryItem: butter },
    { text: "1 lime, juiced", pantryItem: null },
    { text: "1 tbsp butter", pantryItem: butter },
    { text: "3 eggs", pantryItem: item("eggs", "Eggs", "low") },
  ]);
  assert.deepEqual(
    things.map((t) => t.text),
    ["Butter", "1 lime", "3 eggs"]
  );
});

test("unlinked lines merge only when the wording matches", () => {
  const rows = gatherIngredients([recipe("a", "A", ["Dashi"]), recipe("b", "B", ["dashi ", "2 tsp dashi"])], pantry);
  assert.deepEqual(rows.map((r) => r.text), ["Dashi", "2 tsp dashi"]);
});

test("unlinked lines lose their formatting marks, as from the recipe page", () => {
  const rows = gatherIngredients([recipe("a", "A", ["2 tsp *soft* dashi"]), recipe("b", "B", ["2 tsp soft **dashi**"])], pantry);
  assert.deepEqual(rows.map((r) => [r.text, r.recipeTitles.join(" + ")]), [["2 tsp soft dashi", "A + B"]]);
});

test("starts with everything ticked except what we have", () => {
  const rows = gatherIngredients([recipe("a", "A", ["onion", "eggs", "rice", "dashi"])], pantry);
  assert.deepEqual(rows.map((r) => [r.text, startsTicked(r)]), [
    ["onion", false],
    ["eggs", true],
    ["rice", true],
    ["dashi", true],
  ]);
});

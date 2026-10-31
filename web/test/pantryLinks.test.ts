// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { guessPantryItem, linkFor, linkKey, pantryCheck, suggestedName } from "../src/pantryLinks.ts";

const item = (id: string, name: string) => ({ id, name, status: "have" }) as never;
const pantry = [
  item("onion", "Onion"),
  item("eggs", "Eggs"),
  item("tomatoes", "Tomatoes"),
  item("chicken", "Chicken"),
  item("stock", "Chicken stock"),
  item("salt", "Salt"),
  item("rice", "Rice"),
  item("chickpeas", "Chickpeas"),
];
const guess = (line: string) => (guessPantryItem(line, pantry) as { id: string } | null)?.id ?? null;

test("guesses pantry items from ingredient lines, allowing plurals", () => {
  assert.equal(guess("2 onions, diced"), "onion");
  assert.equal(guess("1 egg"), "eggs");
  assert.equal(guess("3 large eggs (50 g each)"), "eggs");
  assert.equal(guess("400g tin of tomatoes"), "tomatoes");
  assert.equal(guess("1 tomato, chopped"), "tomatoes");
  assert.equal(guess("1 tin chickpeas"), "chickpeas");
  assert.equal(guess("1 cup Rice"), "rice");
});

test("prefers the longest matching name", () => {
  assert.equal(guess("500ml chicken stock"), "stock");
  assert.equal(guess("2 chicken thighs"), "chicken");
});

test("only matches whole words", () => {
  assert.equal(guess("1 eggplant, sliced"), null);
  assert.equal(guess("50g unsalted butter"), null);
  assert.equal(guess("a pinch of salt"), "salt");
  assert.equal(guess("water"), null);
});

test("a chosen link beats a guess; an empty choice means not a pantry item", () => {
  const line = "2 onions, diced";
  assert.deepEqual(linkFor(line, null, pantry), { kind: "guessed", item: pantry[0] });
  assert.deepEqual(linkFor(line, { [linkKey(line)]: "rice" }, pantry), { kind: "chosen", item: pantry[6] });
  assert.deepEqual(linkFor(line, { [linkKey(line)]: "" }, pantry), { kind: "notPantry", item: null });
  assert.deepEqual(linkFor("water", null, pantry), { kind: "unmatched", item: null });
});

test("falls back to a guess when the chosen item was deleted", () => {
  const line = "2 onions, diced";
  assert.deepEqual(linkFor(line, { [linkKey(line)]: "gone" }, pantry), { kind: "guessed", item: pantry[0] });
});

test("suggests a name for a new pantry item", () => {
  assert.equal(suggestedName("2 large onions, diced"), "Onions");
  assert.equal(suggestedName("1 tin chickpeas"), "Chickpeas");
  assert.equal(suggestedName("½ yellow onion ((4 oz, 113 g; peeled))"), "Yellow onion");
  assert.equal(suggestedName("2 cloves garlic"), "Garlic");
  assert.equal(suggestedName("1 tbsp sake"), "Sake");
  assert.equal(suggestedName("salt"), "Salt");
});

test("checks a recipe against the pantry: low counts as having some", () => {
  const stocked = [item("onion", "Onion"), { id: "rice", name: "Rice", status: "out" } as never, { id: "eggs", name: "Eggs", status: "low" } as never];
  const check = (ingredients: string[], links: Record<string, string> | null = null) => {
    const result = pantryCheck({ ingredients, ingredient_links: links }, stocked);
    return [result.linked, result.out.map((i) => (i as { name: string }).name)];
  };
  assert.deepEqual(check(["# Base", "2 onions", "1 cup rice", "rice for serving", "2 eggs", "water"]), [4, ["Rice"]]);
  assert.deepEqual(check(["2 onions", "2 eggs"]), [2, []]);
  assert.deepEqual(check(["water", "magic"]), [0, []]);
  assert.deepEqual(check(["1 cup rice"], { "1 cup rice": "" }), [0, []]);
});

test("doesn't link a name that's only part of a different product", () => {
  const shelf = [
    item("rice", "Rice"), item("milk", "Milk"), item("garlic", "Garlic"), item("chicken", "Chicken"),
    item("tomatoes", "Tomatoes"), item("butter", "Butter"), item("eggs", "Eggs"), item("flour", "Flour"),
    item("lemons", "Lemons"), item("cream", "Cream"), item("cheese", "Cheese"),
  ];
  const g = (line: string) => (guessPantryItem(line, shelf) as { id: string } | null)?.id ?? null;
  // Different products: no guess.
  assert.equal(g("2 tbsp rice vinegar"), null);
  assert.equal(g("1 can coconut milk"), null);
  assert.equal(g("1 tsp garlic powder"), null);
  assert.equal(g("500ml chicken stock"), null);
  assert.equal(g("2 tbsp tomato paste"), null);
  assert.equal(g("3 tbsp peanut butter"), null);
  assert.equal(g("200g egg noodles"), null);
  assert.equal(g("1 cup almond flour"), null);
  assert.equal(g("½ cup sour cream"), null);
  assert.equal(g("100g cream cheese"), null);
  // The same things on their own, or just described, still match.
  assert.equal(g("1 cup brown rice"), "rice");
  assert.equal(g("2 chicken breasts"), "chicken");
  assert.equal(g("1 cup milk"), "milk");
  assert.equal(g("3 cloves garlic, minced"), "garlic");
  assert.equal(g("juice of 2 lemons"), "lemons");
  assert.equal(g("rice, to serve"), "rice");
  // A line can still match where the name appears a second time on its own.
  assert.equal(g("rice vinegar, for the rice"), "rice");
});

test("a pantry item named for the product still matches it", () => {
  const shelf = [item("rice", "Rice"), item("vinegar", "Rice vinegar")];
  assert.equal((guessPantryItem("2 tbsp rice vinegar", shelf) as { id: string }).id, "vinegar");
  assert.equal((guessPantryItem("1 cup rice", shelf) as { id: string }).id, "rice");
});

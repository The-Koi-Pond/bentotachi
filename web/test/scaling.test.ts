// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { kitchenFraction, scaleLine, servingsCount, servingsText } from "../src/scaling.ts";

test("the amount a line starts with is scaled", () => {
  assert.equal(scaleLine("2 cups flour", 1.5), "3 cups flour");
  assert.equal(scaleLine("1 1/2 cups milk", 2), "3 cups milk");
  assert.equal(scaleLine("½ tsp salt", 0.5), "¼ tsp salt");
  assert.equal(scaleLine("3 eggs", 2), "6 eggs");
  assert.equal(scaleLine("1 onion, diced", 0.5), "½ onion, diced");
});

test("unchanged at the recipe's own size", () => {
  assert.equal(scaleLine("2 cups flour", 1), "2 cups flour");
});

test("ranges scale at both ends", () => {
  assert.equal(scaleLine("1-2 cloves garlic", 1.5), "1½-3 cloves garlic");
  assert.equal(scaleLine("2 to 3 tbsp oil", 2), "4 to 6 tbsp oil");
  assert.equal(scaleLine("1-1/2 lbs beef", 2), "3 lbs beef");
});

test("grams and millilitres come out as round numbers", () => {
  assert.equal(scaleLine("250 g butter", 1.5), "375 g butter");
  assert.equal(scaleLine("125g sugar", 1.5), "190g sugar");
  assert.equal(scaleLine("15 ml soy sauce", 0.5), "7.5 ml soy sauce");
  assert.equal(scaleLine("1.5 kg chicken", 0.5), "0.75 kg chicken");
  assert.equal(scaleLine("1 l stock", 1.5), "1.5 l stock");
});

test("the same amount written another way is scaled too", () => {
  assert.equal(scaleLine("250 g/8 oz butter", 2), "500 g/16 oz butter");
  assert.equal(scaleLine("1 cup (250 ml) milk", 2), "2 cups (500 ml) milk");
  assert.equal(scaleLine("1 cup (250 ml / 8 fl oz) milk", 0.5), "½ cup (125 ml / 4 fl oz) milk");
});

test("sizes after a count stay as they are", () => {
  assert.equal(scaleLine("1 (400 g) can tomatoes", 2), "2 (400 g) can tomatoes");
  assert.equal(scaleLine("2 x 400 g cans chickpeas", 1.5), "3 x 400 g cans chickpeas");
  assert.equal(scaleLine("1 28-ounce can tomatoes", 2), "2 28-ounce can tomatoes");
});

test("unit words follow the amount", () => {
  assert.equal(scaleLine("1 cup rice", 2), "2 cups rice");
  assert.equal(scaleLine("2 cups rice", 0.5), "1 cup rice");
  assert.equal(scaleLine("1 Tablespoon honey", 3), "3 Tablespoons honey");
  assert.equal(scaleLine("1 tbsp honey", 3), "3 tbsp honey");
});

test("a measured amount later in the line, when none starts it", () => {
  assert.equal(scaleLine("Butter, 250 g, softened", 2), "Butter, 500 g, softened");
  assert.equal(scaleLine("Salt, to taste", 2), "Salt, to taste");
});

test("amounts added together are all scaled", () => {
  assert.equal(scaleLine("1/2 cup + 2 tbsp flour", 2), "1 cup + 4 tbsp flour");
  assert.equal(scaleLine("75 g (1/2 cup + 1/2 tablespoon) cake flour", 2), "150 g (1 cup + 1 tablespoon) cake flour");
  assert.equal(scaleLine("1 cup plus 2 tablespoons (255 g) flour", 2), "2 cups plus 4 tablespoons (510 g) flour");
  assert.equal(scaleLine("1 cup and 2 tbsp milk", 0.5), "½ cup and 1 tbsp milk");
  // With a comma before "plus" or "and".
  assert.equal(scaleLine("½ cup, plus 2 tbsp sugar", 2), "1 cup, plus 4 tbsp sugar");
  assert.equal(scaleLine("1 cup, and 1 tsp sugar", 2), "2 cups, and 2 tsp sugar");
  // A comma before something else still stops it.
  assert.equal(scaleLine("250 g butter, 2 eggs", 2), "500 g butter, 2 eggs");
});

test("juice and zest of a fruit scale, with the fruit's plural", () => {
  assert.equal(scaleLine("Juice of 1 lemon", 2), "Juice of 2 lemons");
  assert.equal(scaleLine("Zest of 2 limes", 1.5), "Zest of 3 limes");
  assert.equal(scaleLine("Finely grated zest and juice of 2 oranges", 0.5), "Finely grated zest and juice of 1 orange");
  assert.equal(scaleLine("juice of ½ lemon", 2), "juice of 1 lemon");
  assert.equal(scaleLine("Juice of 1 lemon", 1), "Juice of 1 lemon");
});

test("words between the count and the fruit stay as they are", () => {
  assert.equal(scaleLine("Juice of 1 large lemon", 2), "Juice of 2 large lemons");
  assert.equal(scaleLine("Zest of 1 unwaxed orange", 2), "Zest of 2 unwaxed oranges");
  assert.equal(scaleLine("Juice of 2 large lemons", 0.5), "Juice of 1 large lemon");
  assert.equal(scaleLine("juice of ½ a lemon", 4), "juice of 2 lemons");
  assert.equal(scaleLine("juice of ½ a lemon", 1), "juice of ½ a lemon");
});

test("amounts around a fruit's juice scale too", () => {
  assert.equal(scaleLine("Dressing: 3 tbsp olive oil and juice of 1 lemon", 2), "Dressing: 6 tbsp olive oil and juice of 2 lemons");
  assert.equal(scaleLine("Butter, 250 g, plus the zest of 1 lemon", 2), "Butter, 500 g, plus the zest of 2 lemons");
  assert.equal(scaleLine("2 tbsp oil and the juice of 1 lime", 2), "4 tbsp oil and the juice of 2 limes");
  assert.equal(scaleLine("Juice of 1 lemon (about 3 tbsp)", 2), "Juice of 2 lemons (about 6 tbsp)");
});

test("other fruit and words stay as they are", () => {
  assert.equal(scaleLine("Juice of 1 apple", 2), "Juice of 1 apple");
});

test("words that start like units aren't units", () => {
  assert.equal(scaleLine("2 large eggs", 2), "4 large eggs");
  assert.equal(scaleLine("2 garlic cloves", 2), "4 garlic cloves");
});

test("soft marks around the amount are kept", () => {
  assert.equal(scaleLine("**2 cups** flour", 2), "**4 cups** flour");
  assert.equal(scaleLine("2 eggs *or 3 if small*", 2), "4 eggs *or 3 if small*");
});

test("kitchen fractions", () => {
  assert.equal(kitchenFraction(1.5), "1½");
  assert.equal(kitchenFraction(0.33), "⅓");
  assert.equal(kitchenFraction(2.7), "2⅔");
  assert.equal(kitchenFraction(2.74), "2¾");
  assert.equal(kitchenFraction(0.125), "⅛");
  assert.equal(kitchenFraction(0.01), "⅛");
  assert.equal(kitchenFraction(1.95), "2");
});

test("how many a recipe makes", () => {
  assert.equal(servingsCount("4"), 4);
  assert.equal(servingsCount("Serves 4-6"), 4);
  assert.equal(servingsCount("12 cookies"), 12);
  assert.equal(servingsCount("One loaf"), null);
  assert.equal(servingsCount(""), null);
  assert.equal(servingsText("Serves 4-6", 8), "Serves 8");
  assert.equal(servingsText("12 cookies", 24), "24 cookies");
  assert.equal(servingsText("4 servings", 6), "6 servings");
});

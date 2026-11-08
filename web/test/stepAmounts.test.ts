// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { planStepAmounts, readIngredient, withStepAmounts } from "../src/stepAmounts.ts";

const shown = (steps: string[], ingredients: string[], format?: (a: string) => string) => {
  const plan = planStepAmounts(steps, ingredients);
  return steps.map((step, i) => withStepAmounts(step, plan.get(i), format));
};

test("reads an ingredient's amount and name", () => {
  assert.deepEqual(readIngredient("1 tsp dried oregano, crushed"), { amount: "1 tsp", words: ["dried", "oregano"], partly: false });
  assert.equal(readIngredient("2 cloves garlic")?.amount, "2 cloves");
  assert.equal(readIngredient("1 1/2 cups stock")?.amount, "1 1/2 cups");
  assert.equal(readIngredient("2 × 400 g tins chopped tomatoes")?.amount, "2 × 400 g tins");
  assert.equal(readIngredient("500g beef mince")?.amount, "500g");
  assert.equal(readIngredient("1 large egg")?.amount, "1");
  assert.deepEqual(readIngredient("3 garlic cloves, crushed"), { amount: "3 cloves", words: ["garlic"], partly: false });
  // Both ways at once (RecipeTin Eats).
  assert.equal(readIngredient("1.2 kg/ 2.4lb (6 pieces) bone-in chicken thighs")?.amount, "1.2 kg/ 2.4lb");
  assert.equal(readIngredient("2 tbsp/ 30g melted ghee or butter")?.amount, "2 tbsp/ 30g");
  // An amount it can't read whole isn't guessed at.
  assert.equal(readIngredient("1.2 kg/2.4 lb.ish chicken"), null);
  assert.equal(readIngredient("Salt, to taste"), null, "no amount");
  assert.equal(readIngredient("2 tbsp butter, divided")?.partly, true);
});

test("shows the amount after the first step that names an ingredient", () => {
  const ingredients = ["1 tsp dried oregano", "2 cloves garlic, crushed", "1 cup stock", "# Sauce", "2 × 400 g tins chopped tomatoes"];
  const steps = ["Fry the garlic for 1 minute.", "Add the oregano and the tomatoes.", "Pour in the stock and simmer.", "Stir the garlic again."];
  assert.deepEqual(shown(steps, ingredients), [
    "Fry the garlic (2 cloves) for 1 minute.",
    "Add the oregano (1 tsp) and the tomatoes (2 × 400 g tins).",
    "Pour in the stock (1 cup) and simmer.",
    // Only the first step that names it.
    "Stir the garlic again.",
  ]);
});

test("not when it isn't sure which ingredient is meant", () => {
  const ingredients = ["2 tbsp olive oil", "1 tsp sesame oil", "1 kg chicken thighs", "2 cups chicken stock"];
  const steps = ["Heat the oil.", "Brown the chicken.", "Add the chicken stock and the sesame oil."];
  assert.deepEqual(shown(steps, ingredients), [
    // "oil" could be either; "chicken" could be the thighs or the stock.
    "Heat the oil.",
    "Brown the chicken.",
    "Add the chicken stock (2 cups) and the sesame oil (1 tsp).",
  ]);
});

test("not when the step gives its own amount or uses part of it", () => {
  const ingredients = ["4 tbsp butter", "1 tsp salt", "2 cups stock", "1 cup sugar, divided"];
  const steps = ["Melt half the butter.", "Add 1/2 tsp salt.", "Pour in the remaining stock.", "Stir in the sugar."];
  assert.deepEqual(shown(steps, ingredients), steps);
});

test("plurals match, and the hint goes inside the brackets tidily", () => {
  const ingredients = ["3 tomatoes", "1 cup milk"];
  const steps = ["Slice the tomato.", "Warm the milk."];
  const format = (amount: string) => (amount === "1 cup" ? "1 cup (240 ml)" : amount);
  assert.deepEqual(shown(steps, ingredients, format), ["Slice the tomato (3).", "Warm the milk (1 cup, 240 ml)."]);
});

test("the review's wrong amounts don't happen", () => {
  // A size in brackets: "can" is part of the amount, not the name.
  assert.deepEqual(
    shown(["If you can, brown the beef.", "Add the tomatoes."], ["500 g minced beef", "1 (400 g) can chopped tomatoes"]),
    ["If you can, brown the beef (500 g).", "Add the tomatoes (1 (400 g) can)."]
  );
  // Olive oil and olives: "olive" could be either.
  assert.deepEqual(shown(["Toss the olives.", "Drizzle with olive oil."], ["2 tbsp olive oil", "1/2 cup kalamata olives"]), [
    "Toss the olives.",
    "Drizzle with olive oil (2 tbsp).",
  ]);
  // "Chicken" in a step isn't the chicken breast's amount next to stock.
  assert.deepEqual(shown(["Pour in the chicken stock."], ["500 g chicken breast", "2 cups stock"]), ["Pour in the chicken stock (2 cups)."]);
  // Water is in too many steps.
  assert.deepEqual(shown(["Soak in boiled water for 1 minute."], ["1/4 cup water", "200 g noodles"]), ["Soak in boiled water for 1 minute."]);
  // A word only inside another name ("cooking" in cooking wine) isn't its name.
  assert.deepEqual(shown(["Rinse to stop it cooking."], ["1 1/2 tbsp Chinese cooking wine"]), ["Rinse to stop it cooking."]);
  // "Each" is two things.
  assert.deepEqual(shown(["Cut each chicken breast in half."], ["1 tsp each salt and pepper", "2 chicken breasts"]), [
    "Cut each chicken breast (2) in half.",
  ]);
});

test("whole words only, headings skipped, first mention, ranges and pinches", () => {
  assert.deepEqual(shown(["Bring a pot to the boil.", "Slice the eggplant."], ["2 tbsp olive oil", "2 eggs"]), [
    "Bring a pot to the boil.",
    "Slice the eggplant.",
  ]);
  assert.deepEqual(shown(["# Chicken", "Brown the thighs, then turn the thighs."], ["1 kg chicken thighs"]), [
    "# Chicken",
    "Brown the thighs (1 kg), then turn the thighs.",
  ]);
  assert.deepEqual(shown(["Add a pinch of salt.", "Pour in the stock."], ["1 tsp salt", "2 to 3 cups stock"]), [
    "Add a pinch of salt.",
    "Pour in the stock (2 to 3 cups).",
  ]);
  assert.equal(readIngredient("2 inch piece ginger, grated")?.amount, "2 inch piece");
});

test("a name already followed by brackets, or with formatting marks, is handled", () => {
  const ingredients = ["1 tsp cumin", "2 tbsp **ghee**"];
  const steps = ["Toast the cumin (whole seeds) first.", "Melt the **ghee**."];
  assert.deepEqual(shown(steps, ingredients), ["Toast the cumin (whole seeds) first.", "Melt the **ghee (2 tbsp)**."]);
});

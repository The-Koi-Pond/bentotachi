// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { recipeAsText } from "../src/recipeText.ts";

const soup = {
  title: "Pumpkin soup",
  servings: "4 servings",
  prep_minutes: 10,
  cook_minutes: 30,
  total_minutes: 0,
  ingredients: ["1 kg pumpkin", "# Topping", "**2 tbsp** pepitas *toasted*"],
  steps: ["Roast the pumpkin.", "Blend with 2 cups stock.", "# To serve", "Top with pepitas."],
  source_url: "https://www.example.com/soup",
};

test("a recipe as text to share", () => {
  assert.equal(
    recipeAsText(soup),
    [
      "Pumpkin soup",
      "Makes 4 servings · Prep 10 min · Cook 30 min · Total 40 min",
      "",
      "Ingredients",
      "- 1 kg pumpkin",
      "\nTopping:",
      "- 2 tbsp pepitas toasted",
      "",
      "Method",
      "1. Roast the pumpkin.",
      "2. Blend with 2 cups stock.",
      "\nTo serve:",
      "1. Top with pepitas.",
      "",
      "From https://www.example.com/soup",
    ].join("\n")
  );
});

test("shared at the size it's scaled to", () => {
  const text = recipeAsText(soup, 1.5);
  assert.match(text, /Makes 6 servings/);
  assert.match(text, /- 1\.5 kg pumpkin/);
  assert.match(text, /- 3 tbsp pepitas/);
  // The method stays as written.
  assert.match(text, /2\. Blend with 2 cups stock\./);
});

test("only what the recipe has", () => {
  assert.equal(
    recipeAsText({ title: "Toast", prep_minutes: 0, cook_minutes: 0, total_minutes: 0, ingredients: ["Bread"], steps: [] }),
    "Toast\n\nIngredients\n- Bread"
  );
});

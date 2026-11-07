// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { readPastedRecipe } from "../src/pastedRecipe.ts";

test("a recipe copied from a page, with headings, times and numbered steps", () => {
  const recipe = readPastedRecipe(`Creamy Garlic Pasta
A quick weeknight dinner.

Serves: 4
Prep Time: 10 mins
Cook Time: 20 minutes

Ingredients
▢ 400 g spaghetti
▢ 4 garlic cloves, crushed
For the sauce:
- 300 ml cream
- 1 cup parmesan

Instructions
1. Cook the pasta in salted water.
2. Fry the garlic, add the cream and simmer.
Step 3: Toss together.

Notes
Leftovers keep for 2 days.`);
  assert.equal(recipe?.title, "Creamy Garlic Pasta");
  assert.equal(recipe?.description, "A quick weeknight dinner.");
  assert.equal(recipe?.servings, "4");
  assert.equal(recipe?.prep_minutes, 10);
  assert.equal(recipe?.cook_minutes, 20);
  assert.deepEqual(recipe?.ingredients, ["400 g spaghetti", "4 garlic cloves, crushed", "# For the sauce", "300 ml cream", "1 cup parmesan"]);
  assert.deepEqual(recipe?.steps, ["Cook the pasta in salted water.", "Fry the garlic, add the cream and simmer.", "Toss together."]);
  assert.equal(recipe?.notes, "Leftovers keep for 2 days.");
});

test("a social post's caption: emoji, no Method heading, hashtags", () => {
  const recipe = readPastedRecipe(`Honey garlic chicken 🍯🧄 so easy!!

INGREDIENTS:
2 chicken breasts
3 tbsp honey
2 cloves garlic
Season the chicken and pan fry for 6 minutes each side.
Add the honey and garlic and cook until sticky.

#dinner #easyrecipes #chicken`);
  assert.equal(recipe?.title, "Honey garlic chicken 🍯🧄 so easy!!");
  assert.deepEqual(recipe?.ingredients, ["2 chicken breasts", "3 tbsp honey", "2 cloves garlic"]);
  assert.deepEqual(recipe?.steps, ["Season the chicken and pan fry for 6 minutes each side.", "Add the honey and garlic and cook until sticky."]);
});

test("no headings at all: the name, the ingredient-like lines, then the steps", () => {
  const recipe = readPastedRecipe(`Nan's scones
3 cups self-raising flour
1 cup cream
1 cup lemonade
Mix it all together gently until it just comes together.
Bake at 220°C for 15 minutes.`);
  assert.equal(recipe?.title, "Nan's scones");
  assert.deepEqual(recipe?.ingredients, ["3 cups self-raising flour", "1 cup cream", "1 cup lemonade"]);
  assert.equal(recipe?.steps.length, 2);
});

test("steps that start with Cook or Prep stay steps; only labelled times count (found in review)", () => {
  const recipe = readPastedRecipe(`Fried rice
Cook Time 20 minutes

Ingredients
2 cups rice
2 eggs

Method
Cook the rice for 5 minutes until crispy.
- Prep the spring onions while it cooks, about 2 minutes.
Add the eggs.

Notes
Makes great leftovers.`);
  assert.equal(recipe?.cook_minutes, 20);
  assert.equal(recipe?.prep_minutes, 0);
  assert.deepEqual(recipe?.steps, ["Cook the rice for 5 minutes until crispy.", "Prep the spring onions while it cooks, about 2 minutes.", "Add the eggs."]);
  assert.equal(recipe?.servings, "");
  assert.equal(recipe?.notes, "Makes great leftovers.");
  // The same without any headings.
  assert.ok(readPastedRecipe("Rice\n2 cups rice\nCook for 12 minutes with the lid on.")?.steps.includes("Cook for 12 minutes with the lid on."));
});

test("headings after an emoji or a notes app's ##, and with the text on the same line", () => {
  const caption = readPastedRecipe(`Banana bread 🍌
🛒 Ingredients:
3 bananas
2 cups flour
👩‍🍳 Method:
Mash the bananas and mix everything.
Bake for 50 minutes.`);
  assert.deepEqual(caption?.ingredients, ["3 bananas", "2 cups flour"]);
  assert.equal(caption?.steps.length, 2);
  const notes = readPastedRecipe("## Chicken soup\n### Ingredients\n1 chicken\n2 carrots\n### Instructions\nSimmer it all for an hour.");
  assert.equal(notes?.title, "Chicken soup");
  assert.deepEqual(notes?.steps, ["Simmer it all for an hour."]);
  const email = readPastedRecipe(`Brownies
Ingredients: 200 g chocolate
100 g butter
Method: Melt, mix, bake
Note: freezes well`);
  assert.deepEqual(email?.ingredients, ["200 g chocolate", "100 g butter"]);
  assert.deepEqual(email?.steps, ["Melt, mix, bake"]);
  assert.equal(email?.notes, "freezes well");
});

test("one line of times and servings, and ingredient groups written as 'Ingredients for…'", () => {
  const recipe = readPastedRecipe(`Pizza
Prep: 10 mins | Cook: 15 mins | Serves: 4
Ingredients for the dough
2 cups flour
Ingredients for the topping
1 cup cheese
Method
Make the dough, top it and bake.`);
  assert.equal(recipe?.prep_minutes, 10);
  assert.equal(recipe?.cook_minutes, 15);
  assert.equal(recipe?.servings, "4");
  assert.deepEqual(recipe?.ingredients, ["# For the dough", "2 cups flour", "# For the topping", "1 cup cheese"]);
});

test("a Note: or Tip: in the middle of a list goes to the notes, and the list carries on (found in review)", () => {
  const recipe = readPastedRecipe(`Brownies
Ingredients
200g dark chocolate
Note: use 70% if you can
3 eggs
Method
1. Melt the chocolate.
Tip: don't let it get too hot
2. Beat in the eggs.`);
  assert.deepEqual(recipe?.ingredients, ["200g dark chocolate", "3 eggs"]);
  assert.deepEqual(recipe?.steps, ["Melt the chocolate.", "Beat in the eggs."]);
  assert.equal(recipe?.notes, "use 70% if you can\ndon't let it get too hot");
});

test("a 'Notes:' heading with text starts the notes, which run on (found in review)", () => {
  const recipe = readPastedRecipe(`Cake
Ingredients
2 cups flour
2 eggs
Method
Mix and bake.
Notes: Keeps 3 days in a tin.
Freezes for up to a month.`);
  assert.deepEqual(recipe?.steps, ["Mix and bake."]);
  assert.equal(recipe?.notes, "Keeps 3 days in a tin.\nFreezes for up to a month.");
});

test("times written several ways", () => {
  const minutes = (line: string) => readPastedRecipe(`Stew\n${line}\nIngredients\n1 onion\n2 carrots\nMethod\nSimmer.`);
  assert.equal(minutes("Prep time: 1 hour, 15 minutes")?.prep_minutes, 75);
  assert.equal(minutes("Cook: 1h30")?.cook_minutes, 90);
  assert.equal(minutes("Total: 2 hrs 45 mins")?.total_minutes, 165);
  assert.equal(readPastedRecipe("Soup\nIngredients for 4–6 people\n1 onion\n2 carrots\nMethod\nSimmer.")?.servings, "4–6");
});

test("description lines aren't read as times or servings; a bare number after a label is minutes", () => {
  const recipe = readPastedRecipe(`Pancakes
Ready in 20 minutes, this is our go-to.
Makes a great weekend breakfast.
Prep: 5
🛒 Ingredients for 4 people:
2 cups flour
2 eggs
Method
Whisk and fry.`);
  assert.equal(recipe?.total_minutes, 0);
  assert.equal(recipe?.prep_minutes, 5);
  assert.equal(recipe?.servings, "4");
  assert.equal(recipe?.description, "Ready in 20 minutes, this is our go-to.\nMakes a great weekend breakfast.");
  assert.deepEqual(recipe?.ingredients, ["2 cups flour", "2 eggs"]);
  assert.deepEqual(readPastedRecipe("Bread\n🛒 Ingredients for the dough\n2 cups flour\nMethod\nKnead it.")?.ingredients, ["# For the dough", "2 cups flour"]);
});

test("text with no recipe in it gives nothing", () => {
  assert.equal(readPastedRecipe(""), null);
  assert.equal(readPastedRecipe("   \n #yum #food \n"), null);
});

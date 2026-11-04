// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { aisleOf, byAisle, guessAisle } from "../src/aisles.ts";

test("everyday things land in their aisle", () => {
  assert.equal(guessAisle("Milk"), "Dairy & eggs");
  assert.equal(guessAisle("2 onions, diced"), "Fruit & veg");
  assert.equal(guessAisle("Chicken thighs"), "Meat & fish");
  assert.equal(guessAisle("Sourdough loaf"), "Bakery");
  assert.equal(guessAisle("Spaghetti"), "Pasta, rice & grains");
  assert.equal(guessAisle("Olive oil"), "Sauces & oils");
  assert.equal(guessAisle("Ground cumin"), "Baking & spices");
  assert.equal(guessAisle("Toilet paper"), "Household");
  assert.equal(guessAisle("Eggs"), "Dairy & eggs");
});

test("the telling word wins", () => {
  assert.equal(guessAisle("Frozen peas"), "Frozen");
  assert.equal(guessAisle("Tinned tomatoes"), "Tins & jars");
  assert.equal(guessAisle("Garlic bread"), "Bakery");
  assert.equal(guessAisle("Chicken stock"), "Tins & jars");
  assert.equal(guessAisle("Rice vinegar"), "Sauces & oils");
  assert.equal(guessAisle("Milk chocolate"), "Snacks & drinks");
});

test("two-word names before single words", () => {
  assert.equal(guessAisle("Coconut milk"), "Tins & jars");
  assert.equal(guessAisle("Red pepper"), "Fruit & veg");
  assert.equal(guessAisle("Black pepper"), "Baking & spices");
  assert.equal(guessAisle("Sour cream"), "Dairy & eggs");
  assert.equal(guessAisle("Ice cream"), "Frozen");
  assert.equal(guessAisle("Peanut butter"), "Tins & jars");
  assert.equal(guessAisle("Green beans"), "Fruit & veg");
  assert.equal(guessAisle("Soy sauce"), "Sauces & oils");
});

test("what it's made into decides, not what it's made of", () => {
  assert.equal(guessAisle("Rice flour"), "Baking & spices");
  assert.equal(guessAisle("Garlic powder"), "Baking & spices");
  assert.equal(guessAisle("Corn chips"), "Snacks & drinks");
  assert.equal(guessAisle("Tomato sauce"), "Sauces & oils");
  assert.equal(guessAisle("Apple juice"), "Snacks & drinks");
  assert.equal(guessAisle("Butter beans"), "Tins & jars");
});

test("plurals", () => {
  assert.equal(guessAisle("Mixed berries"), "Fruit & veg");
  assert.equal(guessAisle("Potatoes"), "Fruit & veg");
  assert.equal(guessAisle("Unsalted butter"), "Dairy & eggs");
});

test("not part of another word", () => {
  assert.equal(guessAisle("Eggplant"), "Fruit & veg");
  assert.equal(guessAisle("Pecans"), "Snacks & drinks");
  assert.equal(guessAisle("Birthday candles"), "Other");
});

test("unknown things go under Other", () => {
  assert.equal(guessAisle("Something for Sam"), "Other");
  assert.equal(guessAisle(""), "Other");
});

test("linked things go where the pantry keeps them", () => {
  assert.equal(aisleOf("Peas", { name: "Peas", location: "Freezer", subcategory: "Vegetables" }), "Frozen");
  assert.equal(aisleOf("Feta", { name: "Feta", location: "Fridge", subcategory: "Dairy" }), "Dairy & eggs");
  assert.equal(aisleOf("Stuff", { name: "Stuff", location: "Cupboard", subcategory: "Tins & jars" }), "Tins & jars");
  // Shelves households make themselves.
  assert.equal(aisleOf("Buldak", { name: "Buldak", location: "Cupboard", subcategory: "Noodles" }), "Pasta, rice & grains");
  assert.equal(aisleOf("Kecap manis", { name: "Kecap manis", location: "Cupboard", subcategory: "Sauce" }), "Sauces & oils");
  // A subcategory the pantry made up: guessed from the pantry item's name.
  assert.equal(aisleOf("Za'atar", { name: "Za'atar spice mix", location: "Cupboard", subcategory: "Middle shelf" }), "Baking & spices");
});

test("grouped in walking order, each group in its own order", () => {
  const groups = byAisle(["Milk", "Onion", "Cheese", "Bread", "Mystery"], guessAisle);
  assert.deepEqual(
    groups.map((g) => [g.aisle, g.things]),
    [
      ["Fruit & veg", ["Onion"]],
      ["Bakery", ["Bread"]],
      ["Dairy & eggs", ["Milk", "Cheese"]],
      ["Other", ["Mystery"]],
    ]
  );
});

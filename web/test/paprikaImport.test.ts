// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync, strToU8, zipSync } from "fflate";
import { alreadyHave, fromPaprika, readPaprikaFile, toMinutes } from "../src/paprikaImport.ts";
import { paprikaFile, toPaprika } from "../src/paprikaExport.ts";

// A 1×1 PNG.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const paprika = {
  uid: "A1",
  name: "Lemon tart",
  description: "Sharp and buttery.",
  ingredients: "For the pastry:\n200 g flour\n100 g butter\n\nFor the filling:\n4 lemons\nSalt: a pinch",
  directions: "Make the pastry.\n\nBake blind for 15 minutes.\nFill and bake.",
  notes: "Freezes well.",
  servings: "8",
  prep_time: "30 mins",
  cook_time: "1 hr 10 min",
  total_time: "",
  source_url: "https://www.example.com/tart",
  categories: ["Dessert", "Baking", "dessert"],
  photo_data: PNG,
  rating: 4,
};

test("a Paprika recipe in Bento's shape", () => {
  const recipe = fromPaprika(paprika);
  assert.equal(recipe.title, "Lemon tart");
  assert.equal(recipe.servings, "8");
  assert.equal(recipe.prep_minutes, 30);
  assert.equal(recipe.cook_minutes, 70);
  assert.equal(recipe.total_minutes, 0);
  assert.deepEqual(recipe.ingredients, ["# For the pastry", "200 g flour", "100 g butter", "# For the filling", "4 lemons", "Salt: a pinch"]);
  assert.deepEqual(recipe.steps, ["Make the pastry.", "Bake blind for 15 minutes.", "Fill and bake."]);
  assert.deepEqual(recipe.tags, ["dessert", "baking"]);
  assert.equal(recipe.notes, "Freezes well.");
  assert.equal(recipe.photo?.type, "image/png");
});

test("times as Paprika apps write them", () => {
  assert.equal(toMinutes("15 mins"), 15);
  assert.equal(toMinutes("1 hour"), 60);
  assert.equal(toMinutes("1 hr 30 min"), 90);
  assert.equal(toMinutes(""), 0);
  assert.equal(toMinutes(undefined), 0);
});

test("a whole file, zipped or single", () => {
  const entry = gzipSync(strToU8(JSON.stringify(paprika)));
  const zipped = zipSync({ "Lemon tart.paprikarecipe": entry, "broken.paprikarecipe": strToU8("not json") }, { level: 0 });
  const read = readPaprikaFile(zipped);
  assert.equal(read.recipes.length, 1);
  assert.equal(read.unreadable, 1);
  assert.equal(readPaprikaFile(entry).recipes[0].name, "Lemon tart");
  assert.equal(readPaprikaFile(strToU8("rubbish")).unreadable, 1);
});

test("Bento's own export comes back as it was", () => {
  const original = {
    id: "r1",
    title: "Pumpkin soup",
    description: "",
    source_url: "https://www.taste.com.au/soup",
    servings: "4",
    prep_minutes: 10,
    cook_minutes: 30,
    total_minutes: 0,
    ingredients: ["# Soup", "1 kg pumpkin", "**2 tbsp** oil"],
    steps: ["Roast.", "Blend."],
    tags: ["soup", "winter"],
    notes: "Double it.",
    author_notes: "Use butternut.",
    created: "2026-10-31 09:15:00.000Z",
  };
  const file = paprikaFile([toPaprika(original, PNG, 5)]);
  const back = fromPaprika(readPaprikaFile(file).recipes[0]);
  assert.equal(back.title, "Pumpkin soup");
  assert.deepEqual(back.ingredients, ["# Soup", "1 kg pumpkin", "2 tbsp oil"]);
  assert.deepEqual(back.steps, ["Roast.", "Blend."]);
  assert.deepEqual(back.tags, ["soup", "winter"]);
  assert.equal(back.notes, "Double it.");
  assert.equal(back.author_notes, "Use butternut.");
  assert.equal(back.prep_minutes, 10);
  assert.equal(back.cook_minutes, 30);
  // The export writes the total it showed (40), so it comes back as one.
  assert.equal(back.total_minutes, 40);
  assert.ok(back.photo);
});

test("recipes we already have are skipped", () => {
  const tart = fromPaprika(paprika);
  assert.equal(alreadyHave(tart, [{ title: "lemon tart", source_url: "https://www.example.com/tart" }]), true);
  assert.equal(alreadyHave(tart, [{ title: "Lemon tart", source_url: "" }]), true);
  assert.equal(alreadyHave(tart, [{ title: "Lemon tart", source_url: "https://other.example.com/tart" }]), false);
  assert.equal(alreadyHave(tart, [{ title: "Lime tart" }]), false);
});

test("odd values don't break it", () => {
  const recipe = fromPaprika({ name: "  ", ingredients: null, directions: 42, categories: "x", source_url: "javascript:alert(1)" });
  assert.equal(recipe.title, "Untitled recipe");
  assert.deepEqual(recipe.ingredients, []);
  assert.deepEqual(recipe.steps, []);
  assert.deepEqual(recipe.tags, []);
  assert.equal(recipe.source_url, "");
  assert.equal(recipe.photo, null);
});

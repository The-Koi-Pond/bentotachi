// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync, strFromU8, unzipSync } from "fflate";
import { paprikaFile, toPaprika, type ExportRecipe } from "../src/paprikaExport.ts";

const recipe: ExportRecipe = {
  id: "abc123",
  title: "Chicken **chasseur**",
  description: "A French *classic*.",
  source_url: "https://www.recipetineats.com/chicken-chasseur/",
  servings: "4",
  prep_minutes: 15,
  cook_minutes: 40,
  total_minutes: 55,
  ingredients: ["# Chicken", "4 chicken thighs", "# Sauce", "1 cup stock", ""],
  steps: ["Brown the chicken.", "Make the sauce."],
  tags: ["dinner", "french"],
  notes: "Kids loved it.",
  author_notes: "Use thighs, not breast.",
  created: "2026-10-30 09:15:00.000Z",
};

test("a Bento recipe in Paprika's shape", () => {
  const p = toPaprika(recipe, "", 4.4);
  assert.equal(p.name, "Chicken chasseur");
  assert.equal(p.description, "A French classic.");
  assert.equal(p.ingredients, "Chicken:\n4 chicken thighs\nSauce:\n1 cup stock");
  assert.equal(p.directions, "Brown the chicken.\n\nMake the sauce.");
  assert.equal(p.notes, "Kids loved it.\n\nFrom the recipe's writer:\nUse thighs, not breast.");
  assert.equal(p.prep_time, "15 min");
  assert.equal(p.total_time, "55 min");
  const noTotal = toPaprika({ ...recipe, total_minutes: 0, extra_times: [{ label: "Cool", minutes: 420 }] }, "", 0);
  assert.equal(noTotal.total_time, "7 h 55 min");
  assert.match(noTotal.notes, /Other times: Cool: 7 h$/);
  assert.equal(p.source, "recipetineats.com");
  assert.deepEqual(p.categories, ["dinner", "french"]);
  assert.equal(p.rating, 4);
  assert.equal(p.created, "2026-10-30 09:15:00");
  assert.equal(p.photo, "");
});

test("the file is a zip of gzipped JSON, one per recipe, readable like Mealie and Tandoor do", () => {
  const bytes = paprikaFile([
    toPaprika(recipe, "aGVsbG8=", 0),
    toPaprika({ ...recipe, id: "def456" }, "", 0),
    toPaprika({ ...recipe, id: "ghi789", title: 'Mac/cheese: "best"', prep_minutes: 0 }, "", 0),
  ]);
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  assert.deepEqual(names, ["Chicken chasseur.paprikarecipe", "Chicken chasseur (2).paprikarecipe", "Maccheese best.paprikarecipe"]);
  const first = JSON.parse(strFromU8(gunzipSync(files[names[0]])));
  // Tandoor reads these without a default, so they must all be there.
  for (const key of ["name", "directions", "notes", "nutritional_info", "source", "source_url", "ingredients"])
    assert.equal(typeof first[key], "string", key);
  assert.equal(first.photo_data, "aGVsbG8=");
  assert.equal(first.photo, "abc123.jpg");
  const third = JSON.parse(strFromU8(gunzipSync(files[names[2]])));
  assert.equal(third.name, 'Mac/cheese: "best"');
  assert.equal(third.prep_time, "");
});

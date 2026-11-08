// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { looksDifferent, reimportChanges } from "../src/reimport.ts";

const now = {
  ingredients: ["1 kg chicken thighs", "1 cup yoghurt"],
  steps: ["Marinate.", "Bake."],
  ingredient_links: { "1 cup yoghurt": "yoghurt-id" },
  photo_steps: { "p_a.jpg": "bake." },
  photos: ["p_a.jpg"],
  tags: ["ours"],
};

test("the site's parts replace the recipe's; links, step photos and tags carry over", () => {
  const data = reimportChanges(now, {
    title: "Butter chicken",
    description: "Rich.",
    ingredients: ["1 kg chicken thighs", "# Marinade", "1 cup yoghurt"],
    steps: ["Marinate.", "Bake."],
    tags: ["indian", "ours"],
    authorNotes: "Use thighs.",
    prepMinutes: 10,
  });
  assert.deepEqual(data.ingredients, ["1 kg chicken thighs", "# Marinade", "1 cup yoghurt"]);
  // A heading added doesn't lose the yoghurt's pantry link or the step photo.
  assert.deepEqual(data.ingredient_links, { "1 cup yoghurt": "yoghurt-id" });
  assert.deepEqual(data.photo_steps, { "p_a.jpg": "bake." });
  assert.deepEqual(data.tags, ["ours", "indian"]);
  assert.equal(data.description, "Rich.");
  assert.equal(data.author_notes, "Use thighs.");
  assert.equal(data.prep_minutes, 10);
  // The name isn't the site's to change.
  assert.equal("title" in data, false);
});

test("what the site no longer gives stays as it was", () => {
  const data = reimportChanges(now, { ingredients: [], steps: [], description: "", servings: "" });
  assert.deepEqual(data.ingredients, now.ingredients);
  assert.deepEqual(data.steps, now.steps);
  assert.equal("description" in data, false);
  assert.equal("servings" in data, false);
  assert.equal("cook_minutes" in data, false);
});

test("a site recipe with nothing in common by name looks different", () => {
  assert.equal(looksDifferent("Our butter chicken", "One-pan Baked Butter Chicken"), false);
  assert.equal(looksDifferent("Butter chicken", "Lemon drizzle cake"), true);
  assert.equal(looksDifferent("Shakshuka", undefined), false);
});

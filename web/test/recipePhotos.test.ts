// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  carriedStepPhotos,
  galleryPhotos,
  numberedSteps,
  savedName,
  stepPhotos,
  uploadName,
} from "../src/recipePhotos.ts";

const steps = ["# The sauce", "Fry the onions.", "Add the tomatoes.", "## Then", "Simmer.", "# Eggs", "Crack in the eggs."];

test("steps are numbered like the recipe page", () => {
  assert.deepEqual(
    numberedSteps(steps).map((s) => [s.number, s.line]),
    [
      [1, "Fry the onions."],
      [2, "Add the tomatoes."],
      [3, "Simmer."],
      [1, "Crack in the eggs."],
    ]
  );
  assert.equal(numberedSteps(steps)[3].index, 6);
});

test("a photo shows with its step, the rest in the gallery", () => {
  const recipe = {
    steps,
    photos: ["a.jpg", "b.jpg", "c.jpg", "d.jpg"],
    photo_steps: { "a.jpg": "fry the onions.", "b.jpg": "fry the onions.", "c.jpg": "a step that's gone" },
  };
  assert.deepEqual([...stepPhotos(recipe)], [["fry the onions.", ["a.jpg", "b.jpg"]]]);
  // c's step is gone, so it's back in the gallery, with d.
  assert.deepEqual(galleryPhotos(recipe), ["c.jpg", "d.jpg"]);
});

test("a photo whose file is gone is left out", () => {
  const recipe = { steps, photos: ["a.jpg"], photo_steps: { "a.jpg": "simmer.", "gone.jpg": "simmer." } };
  assert.deepEqual([...stepPhotos(recipe)], [["simmer.", ["a.jpg"]]]);
});

test("a step that moved keeps its photo", () => {
  const moved = ["Add the tomatoes.", "Fry the onions.", "Simmer."];
  const carried = carriedStepPhotos(steps, moved, { "a.jpg": "fry the onions." }, ["a.jpg"]);
  assert.deepEqual(carried, { "a.jpg": "fry the onions." });
});

test("a reworded step in the same place keeps its photo", () => {
  const reworded = ["# The sauce", "Fry the onions until soft.", "Add the tomatoes.", "## Then", "Simmer.", "# Eggs", "Crack in the eggs."];
  assert.deepEqual(carriedStepPhotos(steps, reworded, { "a.jpg": "fry the onions." }, ["a.jpg"]), {
    "a.jpg": "fry the onions until soft.",
  });
});

test("a new step above changes nothing for steps that stay word for word", () => {
  const added = ["Heat the oven.", ...steps];
  assert.deepEqual(carriedStepPhotos(steps, added, { "a.jpg": "simmer." }, ["a.jpg"]), { "a.jpg": "simmer." });
});

test("a reworded step after a step was added above goes back to the gallery, not onto the wrong step", () => {
  // "Heat the oven." added above, and "Fry the onions." reworded: the place
  // no longer means the same step.
  const changed = ["Heat the oven.", "Fry the onions slowly.", "Add the tomatoes.", "Simmer.", "Crack in the eggs."];
  assert.deepEqual(carriedStepPhotos(steps, changed, { "a.jpg": "fry the onions." }, ["a.jpg"]), {});
});

test("a deleted step's photo goes back to the gallery", () => {
  const removed = ["Add the tomatoes.", "Simmer.", "Crack in the eggs."];
  assert.deepEqual(carriedStepPhotos(steps, removed, { "a.jpg": "fry the onions." }, ["a.jpg"]), {});
});

test("photos no longer on the recipe are dropped", () => {
  assert.deepEqual(carriedStepPhotos(steps, steps, { "a.jpg": "simmer.", "b.jpg": "simmer." }, ["a.jpg"]), { "a.jpg": "simmer." });
});

test("a sent photo is found among the saved ones by its made-up name", () => {
  const sent = uploadName();
  assert.match(sent, /^p[a-z0-9]{8}\.jpg$/);
  const base = sent.slice(0, -4);
  assert.equal(savedName(sent, ["other_abc.jpg", `${base}_a1b2c3d4e5.jpg`]), `${base}_a1b2c3d4e5.jpg`);
  assert.equal(savedName(sent, ["other_abc.jpg"]), undefined);
});

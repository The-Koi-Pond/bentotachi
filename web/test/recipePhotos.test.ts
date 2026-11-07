// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  carriedStepPhotos,
  galleryPhotos,
  numberedSteps,
  samePhotoSteps,
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

test("a step that moves up into a deleted step's place doesn't take its photo", () => {
  // "Fry the onions." (with the photo) is deleted; "Add the tomatoes." was
  // already there and moves up into its place.
  const removed = ["# The sauce", "Add the tomatoes.", "Simmer.", "Crack in the eggs."];
  assert.deepEqual(carriedStepPhotos(steps, removed, { "a.jpg": "fry the onions." }, ["a.jpg"]), {});
});

test("merging two steps and adding one after doesn't put the photo on the new step", () => {
  const before = ["Chop the onions.", "Fry the onions.", "Serve."];
  const after = ["Chop and fry the onions.", "Season to taste.", "Serve."];
  assert.deepEqual(carriedStepPhotos(before, after, { "f.jpg": "fry the onions." }, ["f.jpg"]), {});
});

test("whether photo_steps changed", () => {
  assert.equal(samePhotoSteps({ "a.jpg": "simmer." }, { "a.jpg": "simmer." }), true);
  assert.equal(samePhotoSteps(null, {}), true);
  // A dropped entry (its step deleted) is a change, either way round.
  assert.equal(samePhotoSteps({}, { "a.jpg": "simmer." }), false);
  assert.equal(samePhotoSteps({ "a.jpg": "simmer." }, {}), false);
  assert.equal(samePhotoSteps({ "a.jpg": "simmer." }, { "a.jpg": "stir." }), false);
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
  // A name that only starts the same way isn't it.
  assert.equal(savedName(sent, [`${base}x_a1b2c3d4e5.jpg`, `${base.slice(0, 5)}_a1b2c3d4e5.jpg`]), undefined);
});

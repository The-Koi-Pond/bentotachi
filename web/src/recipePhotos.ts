// A recipe's photos besides its cover (the "photos" field):
// a gallery swiped through at the top of the recipe page, and photos shown
// with a step. Which step is kept in photo_steps as { photo file name: the
// step's wording, lower case }, so a step keeps its photo when the steps
// around it change. A photo whose step is gone isn't lost: it shows in the
// gallery again.

import { continuesNumbering, headingOf } from "./format.ts";
import type { Recipe } from "./pb";

// How many photos a recipe keeps besides its cover (the server's limit too,
// see the recipes_photos migration), and how big they're kept.
export const MAX_PHOTOS = 20;
export const PHOTO_SIDE = 1600;

// A step's key in photo_steps. On purpose its own rule, not a shared text
// helper: saved step photos are found by it, so it must never change.
export const stepKey = (line: string) => line.trim().toLowerCase();

export interface NumberedStep {
  index: number; // in recipe.steps
  number: number; // as the recipe page shows it
  line: string;
}

// The steps without their headings, numbered like the recipe page: a #
// heading starts again at 1, a ## heading carries on.
export function numberedSteps(steps: string[] | null | undefined): NumberedStep[] {
  const numbered: NumberedStep[] = [];
  let number = 0;
  (steps ?? []).forEach((line, index) => {
    if (headingOf(line) !== null) {
      if (!continuesNumbering(line)) number = 0;
      return;
    }
    number += 1;
    numbered.push({ index, number, line });
  });
  return numbered;
}

// The photos shown with each step still in the recipe, by step key.
export function stepPhotos(recipe: Pick<Recipe, "photos" | "photo_steps" | "steps">): Map<string, string[]> {
  const keys = new Set(numberedSteps(recipe.steps).map((step) => stepKey(step.line)));
  const byStep = new Map<string, string[]>();
  for (const name of recipe.photos ?? []) {
    const key = recipe.photo_steps?.[name];
    if (!key || !keys.has(key)) continue;
    byStep.set(key, [...(byStep.get(key) ?? []), name]);
  }
  return byStep;
}

// The photos in the gallery: the ones not shown with a step.
export function galleryPhotos(recipe: Pick<Recipe, "photos" | "photo_steps" | "steps">): string[] {
  const onSteps = new Set([...stepPhotos(recipe).values()].flat());
  return (recipe.photos ?? []).filter((name) => !onSteps.has(name));
}

// photo_steps after the steps were edited from oldSteps to newSteps:
// - a step still there word for word keeps its photos, wherever it moved;
// - a reworded step keeps them when it's in the same place among the steps
//   (headings don't count) with nothing added or removed above it, the
//   steps just before and after it unchanged, its old wording gone and its
//   new wording new;
// - otherwise the photo goes back to the gallery.
// Photos no longer on the recipe are left out (`photos`).
export function carriedStepPhotos(
  oldSteps: string[] | null | undefined,
  newSteps: string[] | null | undefined,
  photoSteps: Record<string, string> | null | undefined,
  photos: string[] | null | undefined
): Record<string, string> {
  const before = numberedSteps(oldSteps).map((step) => stepKey(step.line));
  const after = numberedSteps(newSteps).map((step) => stepKey(step.line));
  const oldKeys = new Set(before);
  const newKeys = new Set(after);
  const kept = new Set(photos ?? []);
  const carried: Record<string, string> = {};
  for (const [name, key] of Object.entries(photoSteps ?? {})) {
    if (!kept.has(name)) continue;
    if (newKeys.has(key)) {
      carried[name] = key;
      continue;
    }
    const place = before.indexOf(key);
    if (place < 0 || place >= after.length || oldKeys.has(after[place])) continue;
    // Above that place as many old steps went as new ones came, and the
    // steps either side are the same as before, so it's still that step.
    const gone = before.slice(0, place).filter((k) => !newKeys.has(k)).length;
    const added = after.slice(0, place).filter((k) => !oldKeys.has(k)).length;
    const sameAround = before[place - 1] === after[place - 1] && before[place + 1] === after[place + 1];
    if (gone === added && sameAround) carried[name] = after[place];
  }
  return carried;
}

// Whether two photo_steps say the same, so a save can leave them alone.
export function samePhotoSteps(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined
): boolean {
  const x = a ?? {};
  const y = b ?? {};
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every((name) => y[name] === x[name]);
}

// Sending a photo under a made-up name lets us find it among the saved ones
// afterwards: the server keeps the name and adds "_" and 10 random letters
// ("pk3x9q2ma.jpg" becomes "pk3x9q2ma_a1b2c3d4e5.jpg").
export function uploadName(): string {
  return `p${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}.jpg`;
}

export function savedName(sent: string, names: string[] | null | undefined): string | undefined {
  const base = sent.replace(/\.[^.]*$/, "");
  return (names ?? []).find((name) => name.startsWith(`${base}_`) || name === sent);
}

// The photo_steps for photos sent under made-up names: `sent` pairs each
// photo's own name (Paprika's "Step 2") with the name it was sent under,
// `marks` says which step each own name goes with, and `saved` is what the
// server stored. Photos with no step, or that didn't arrive, are left out
// (they're in the gallery).
export function photoStepsFor(
  sent: [string, string][],
  marks: Record<string, string>,
  saved: string[] | null | undefined
): Record<string, string> {
  const steps: Record<string, string> = {};
  for (const [name, upload] of sent) {
    const file = savedName(upload, saved);
    if (marks[name] && file) steps[file] = stepKey(marks[name]);
  }
  return steps;
}

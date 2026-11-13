// When recipes were last had, from two places: past nights on the dinner
// plan, and "Cooked it" (the buttons on a recipe, or finishing its
// timer), which also covers meals that were never planned. A day counts
// once, however it was recorded. Dates are plain "2026-11-02" (dates.ts).

import { datePart } from "./dates.ts";

interface Dated {
  date: string;
  recipe: string;
}

// The days a recipe was had, oldest first: plan nights before today, and
// cooked days up to and including today.
export function daysHad(recipeId: string, plan: Dated[], cooked: Dated[], today: string): string[] {
  const days = new Set<string>();
  for (const entry of plan) {
    const day = datePart(entry.date);
    if (entry.recipe === recipeId && day < today) days.add(day);
  }
  for (const entry of cooked) {
    const day = datePart(entry.date);
    if (entry.recipe === recipeId && day <= today) days.add(day);
  }
  return [...days].sort();
}

// When each recipe was last had (for the dinner chooser's "Had 2 weeks ago").
export function lastHadByRecipe(plan: Dated[], cooked: Dated[], today: string): Map<string, string> {
  const last = new Map<string, string>();
  const note = (recipe: string, day: string) => {
    if (recipe && day > (last.get(recipe) ?? "")) last.set(recipe, day);
  };
  for (const entry of plan) if (datePart(entry.date) < today) note(entry.recipe, datePart(entry.date));
  for (const entry of cooked) if (datePart(entry.date) <= today) note(entry.recipe, datePart(entry.date));
  return last;
}

// The next night it's planned: today or later, but not today if it's
// already been cooked today.
export function nextPlanned(recipeId: string, plan: Dated[], cooked: Dated[], today: string): string | undefined {
  const cookedToday = cooked.some((entry) => entry.recipe === recipeId && datePart(entry.date) === today);
  return plan
    .filter((entry) => entry.recipe === recipeId)
    .map((entry) => datePart(entry.date))
    .filter((day) => day > today || (day === today && !cookedToday))
    .sort()[0];
}

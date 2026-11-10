// What a recipe's copy (⋯ → Make a copy) is made from: everything that's the
// recipe's own, under its name with "(copy)". Not who added it, ratings,
// the cooked log or the plan, which belong to the original; the photos are
// sent on their own, and their steps follow with photoStepsFor.
import type { Recipe } from "./pb";

const COPIED = [
  "description",
  "source_url",
  "servings",
  "prep_minutes",
  "cook_minutes",
  "total_minutes",
  "extra_times",
  "ingredients",
  "steps",
  "tags",
  "notes",
  "author_notes",
  "nutrition",
  "ingredient_links",
  "site_rating",
  "site_rating_count",
  "image_framing",
] as const satisfies readonly (keyof Recipe)[];

// The name's cut short so " (copy)" fits in the 300 a title may have.
export function copyOf(recipe: Recipe, addedBy: string | undefined): Record<string, unknown> {
  const data: Record<string, unknown> = { title: `${recipe.title.slice(0, 290)} (copy)`, added_by: addedBy };
  for (const field of COPIED) data[field] = recipe[field];
  return data;
}

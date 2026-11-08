// Searching recipes the same way everywhere (the Recipes tab, the dinner
// plan's chooser, the shopping list's "From a recipe"). The typed words go
// through searchVariants (regionalNames.ts) first.

import { foldText } from "./wordMatch.ts";

type Searchable = { title: string; tags: string[] | null; ingredients: string[] | null };

// Every word typed must appear somewhere in the title, tags or ingredients,
// so "chicken quick" finds quick chicken dishes. Any of the variants will do.
// Accents and hyphens don't count ("jalapeno" finds "jalapeños"), as in
// the variants.
export function matchesSearch(recipe: Searchable, variants: string[][]): boolean {
  const haystack = foldText([recipe.title, ...(recipe.tags ?? []), ...(recipe.ingredients ?? [])].join(" "));
  return variants.some((words) => words.every((word) => haystack.includes(word)));
}

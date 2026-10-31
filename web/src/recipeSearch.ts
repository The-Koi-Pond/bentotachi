// Searching recipes the same way everywhere (the Recipes tab and the dinner
// plan's chooser).

import { searchVariants } from "./regionalNames.ts";

type Searchable = { title: string; tags: string[] | null; ingredients: string[] | null };

// "Chicken  Quick" -> [["chicken", "quick"]], plus the same search in the
// other country's words ("capsicum" -> also ["bell pepper"], kept together).
export function searchWords(text: string): string[][] {
  return searchVariants(text);
}

// Every word typed must appear somewhere in the title, tags or ingredients,
// so "chicken quick" finds quick chicken dishes. Any of the variants will do.
export function matchesSearch(recipe: Searchable, variants: string[][]): boolean {
  const haystack = [recipe.title, ...(recipe.tags ?? []), ...(recipe.ingredients ?? [])].join(" ").toLowerCase();
  return variants.some((words) => words.every((word) => haystack.includes(word)));
}

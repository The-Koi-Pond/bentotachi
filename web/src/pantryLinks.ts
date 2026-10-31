// Linking recipe ingredient lines to pantry items.
//
// Bento guesses: a pantry item matches a line if its name appears in it
// (see wordMatch.ts: whole words, plurals allowed, "rice vinegar" isn't
// Rice), or the other region's name for it does ("Capsicum" matches "1 red
// bell pepper"; see regionalNames.ts). The longest matching name wins
// ("Chicken stock" beats "Chicken"). People can override a guess for a
// recipe; those choices are stored on the recipe as ingredient_links, keyed
// by the line's text, and always win over guesses.

import { headingOf } from "./format.ts";
import type { PantryItem, Recipe } from "./pb";
import { mentions, stem } from "./wordMatch.ts";
import { otherNames } from "./regionalNames.ts";

export type IngredientLink =
  | { kind: "chosen" | "guessed"; item: PantryItem }
  | { kind: "notPantry" | "unmatched"; item: null };

const norm = (text: string) => text.trim().toLowerCase();

// The line's key in ingredient_links.
export const linkKey = norm;

// The pantry item whose name (or its other region's name) appears in the
// line, or null.
export function guessPantryItem(line: string, items: PantryItem[]): PantryItem | null {
  let best: PantryItem | null = null;
  let bestLength = 0;
  for (const item of items) {
    const length = stem(item.name).length;
    if (!length || length <= bestLength) continue;
    if (![item.name, ...otherNames(item.name)].some((name) => mentions(line, name))) continue;
    best = item;
    bestLength = length;
  }
  return best;
}

// What a line is linked to: someone's choice for this recipe, else a guess.
export function linkFor(
  line: string,
  links: Record<string, string> | null | undefined,
  items: PantryItem[]
): IngredientLink {
  const key = linkKey(line);
  if (links && key in links) {
    const id = links[key];
    if (!id) return { kind: "notPantry", item: null };
    const item = items.find((i) => i.id === id);
    if (item) return { kind: "chosen", item };
    // The chosen item has been deleted from the pantry: fall back to a guess.
  }
  const guess = guessPantryItem(line, items);
  return guess ? { kind: "guessed", item: guess } : { kind: "unmatched", item: null };
}

// How ready the pantry is for a recipe: how many of its ingredients are
// linked to pantry items, and which of those items are out. Low counts as
// having some.
export function pantryCheck(
  recipe: Pick<Recipe, "ingredients" | "ingredient_links">,
  items: PantryItem[]
): { linked: number; out: PantryItem[] } {
  let linked = 0;
  const out = new Map<string, PantryItem>();
  for (const line of recipe.ingredients ?? []) {
    if (headingOf(line) !== null) continue;
    const { item } = linkFor(line, recipe.ingredient_links, items);
    if (!item) continue;
    linked += 1;
    if (item.status === "out") out.set(item.id, item);
  }
  return { linked, out: [...out.values()] };
}

const AMOUNT_WORDS =
  /^(\d+([./]\d+)?|[½¼¾⅓⅔⅛]|\d+[½¼¾⅓⅔⅛]|a|an|about|cups?|tbsps?|tablespoons?|tsps?|teaspoons?|g|grams?|kg|ml|l|litres?|liters?|oz|ounces?|lbs?|pounds?|tins?|cans?|packets?|pinch(es)?|handfuls?|cloves?|large|small|medium|of|-|–)$/i;

// A starting name for a new pantry item, from the line:
// "2 large onions, diced" -> "Onions"; "1 tin chickpeas" -> "Chickpeas".
export function suggestedName(line: string): string {
  const main = line.split(/[,(]/)[0];
  const words = main.trim().split(/\s+/);
  while (words.length > 1 && AMOUNT_WORDS.test(words[0])) words.shift();
  const name = words.join(" ").trim();
  return name ? name[0].toUpperCase() + name.slice(1) : "";
}

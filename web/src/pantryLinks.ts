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

// Whether a recipe line is worth buying: the pantry is low on it, out of it,
// or doesn't have it at all. Not lines marked "not a pantry item" (water).
// "Add missing from pantry".
export function missingFromPantry(link: IngredientLink): boolean {
  if (link.kind === "notPantry") return false;
  return link.item?.status !== "have";
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

// The recipe's ingredient_links after its ingredients were edited from
// oldLines to newLines. Links are keyed by a line's text, so without this,
// rewording "2 onions" to "3 onions" would lose its link (or its "not a
// pantry item") and leave the old key behind forever. Careful, so a link
// never lands on the wrong line:
// - a line that's still there, word for word, keeps its link wherever it
//   moved to;
// - a reworded line takes the old line's link only when it's in the same
//   place among the ingredients (headings don't count) with nothing added
//   or removed above it, the old wording is gone, the new wording wasn't
//   there before, and it names exactly the same thing, only the amount or
//   the notes after a comma changed ("2 onions" -> "3 onions, diced", but
//   not "soy sauce" -> "fish sauce" or "onions" -> "red onions");
// - links for lines that are gone are dropped.
// Anything else falls back to a guess, as before: better a guess than a
// confident wrong link.
export function carriedLinks(
  oldLines: string[],
  newLines: string[],
  links: Record<string, string> | null | undefined
): Record<string, string> {
  const ingredientsOf = (lines: string[]) => lines.filter((line) => headingOf(line) === null);
  const before = ingredientsOf(oldLines);
  const after = ingredientsOf(newLines);
  const oldKeys = new Set(before.map(linkKey));
  const newKeys = new Set(after.map(linkKey));
  const carried: Record<string, string> = {};
  if (!links) return carried;
  // Above each place: how many old lines went and how many new ones came.
  // Equal means nothing was added or removed there (a reworded line counts
  // once each way), so the place still means the same line.
  let goneAbove = 0;
  let newAbove = 0;
  // Two lines with the same name ("tomatoes, crushed" and "tomatoes, diced")
  // can't be told apart once one goes: only a name that's unique on both
  // sides carries over.
  const count = (lines: string[]) => {
    const counts = new Map<string, number>();
    for (const line of lines) counts.set(nameOf(line), (counts.get(nameOf(line)) ?? 0) + 1);
    return counts;
  };
  const oldNames = count(before);
  const newNames = count(after);
  const unique = (line: string) => oldNames.get(nameOf(line)) === 1 && newNames.get(nameOf(line)) === 1;
  after.forEach((line, i) => {
    const key = linkKey(line);
    const was = i < before.length ? linkKey(before[i]) : "";
    const reworded =
      !!was &&
      goneAbove === newAbove &&
      !newKeys.has(was) &&
      !oldKeys.has(key) &&
      was in links &&
      sameThing(before[i], line) &&
      unique(line);
    if (reworded) carried[key] = links[was];
    else if (key in links) carried[key] = links[key];
    if (i < before.length && !newKeys.has(linkKey(before[i]))) goneAbove += 1;
    if (!oldKeys.has(key)) newAbove += 1;
  });
  return carried;
}

// Whether two ingredient_links maps say the same, so a save can leave them
// alone when nothing changed.
export function sameLinks(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined
): boolean {
  const x = a ?? {};
  const y = b ?? {};
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every((key) => key in y && y[key] === x[key]);
}

// Whether two lines name exactly the same thing: the same words in what
// they're of, amounts, plurals and notes aside ("2 onions" and "3 onions,
// diced"), but not one word in common ("soy sauce" and "fish sauce").
const LITTLE_WORDS = new Set(["of", "and", "or", "the", "a", "an", "to", "for", "with", "in"]);
function sameThing(a: string, b: string): boolean {
  const name = nameOf(a);
  return name !== "" && name === nameOf(b);
}

// A line's name as its sorted, stemmed words, for comparing ("tomatoes,
// diced" and "2 cans tomato" both give "tomato").
function nameOf(line: string): string {
  const words = suggestedName(line)
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((word) => word && !LITTLE_WORDS.has(word))
    .map(stem);
  return [...new Set(words)].sort().join(" ");
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

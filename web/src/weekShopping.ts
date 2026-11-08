// Gathers the ingredients of several planned dinners into one shopping
// list: lines linked to the same pantry item merge into one row ("Onion",
// for two recipes), lines marked "not a pantry item" (like water) are left
// out, and each row says whether it's worth buying.

import { headingOf } from "./format.ts";
import { linkFor } from "./pantryLinks.ts";
import { withoutSoftMarks } from "./softMarks.ts";
import type { PantryItem, Recipe } from "./pb";

export interface GatheredRow {
  // Unique per row: "p:<pantry id>" or "t:<line in lowercase>".
  key: string;
  // What goes on the shopping list: the recipe's words (listWording), or
  // the pantry's name when several recipes need it in different words.
  text: string;
  pantryItem: PantryItem | null;
  // The dinners that need it, in plan order, without repeats.
  recipeTitles: string[];
  // The first recipe that needs it, for the shopping item's "for" note.
  recipeId: string;
}

// How a part after a comma starts when it's how to prepare the thing, not
// another thing to buy: "diced", "finely chopped", "cut into chunks", "to
// serve", "plus extra for dusting", "at room temperature".
const PREPARATION = new Set(
  (
    "diced chopped sliced minced grated shredded crushed peeled cubed halved quartered julienned trimmed " +
    "rinsed drained beaten whisked softened melted cooled chilled divided optional juiced zested seeded " +
    "deseeded cored pitted toasted roasted cooked uncooked thawed defrosted torn picked washed separated " +
    "mashed squeezed stemmed sifted packed heaped scrubbed cut finely roughly thinly coarsely freshly " +
    "lightly very well to for plus at room preferably ideally if such"
  ).split(" ")
);

// The parts of a line between ", " that aren't inside brackets: commas in
// "(2 sticks, 226 g)" don't split it.
function partsOf(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "(" || char === "[") depth++;
    else if ((char === ")" || char === "]") && depth > 0) depth--;
    else if (char === "," && text[i + 1] === " " && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 2;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

// How a recipe line reads on the shopping list: the recipe's own words
// (amount and kind: "12 oz gluten free linguine pasta", not the pantry's
// "Pasta"; Xel, 2026-11-08), without how to prepare it ("2 onions, diced" ->
// "2 onions", "Feta, to serve" -> "Feta"). Only preparation goes: "Salt,
// pepper" and "2 carrots, 2 celery sticks" keep every thing to buy, and
// commas in brackets or decimals ("1,5 kg") don't count (review, 2026-11-08).
export function listWording(line: string): string {
  const parts = partsOf(withoutSoftMarks(line).trim());
  while (parts.length > 1) {
    const first = parts[parts.length - 1].trim().split(/\s+/)[0].toLowerCase();
    if (!PREPARATION.has(first)) break;
    parts.pop();
  }
  return parts.join(", ").trim();
}

// A recipe's chosen lines as things to buy, from its page: each in its own
// words (listWording), except lines sharing a pantry item, which become one
// thing by the pantry's name ("2 tbsp butter" and "1 tbsp butter" ->
// "Butter"), so the list never shows too little.
export function linesToBuy(
  lines: { text: string; pantryItem: PantryItem | null }[]
): { text: string; pantryItem: PantryItem | null }[] {
  const counts = new Map<string, number>();
  for (const { pantryItem } of lines) if (pantryItem) counts.set(pantryItem.id, (counts.get(pantryItem.id) ?? 0) + 1);
  const seen = new Set<string>();
  const things: { text: string; pantryItem: PantryItem | null }[] = [];
  for (const { text, pantryItem } of lines) {
    if (pantryItem && (counts.get(pantryItem.id) ?? 0) > 1) {
      if (seen.has(pantryItem.id)) continue;
      seen.add(pantryItem.id);
      things.push({ text: pantryItem.name, pantryItem });
    } else {
      things.push({ text: listWording(text), pantryItem });
    }
  }
  return things;
}

export function gatherIngredients(dinners: Recipe[], pantry: PantryItem[]): GatheredRow[] {
  const rows = new Map<string, GatheredRow>();
  for (const recipe of dinners) {
    for (const line of recipe.ingredients ?? []) {
      if (headingOf(line) !== null || !line.trim()) continue;
      const link = linkFor(line, recipe.ingredient_links, pantry);
      if (link.kind === "notPantry") continue;
      // As when adding from the recipe page (listWording), so the list's
      // duplicate check sees the same words.
      const plain = listWording(line);
      const key = link.item ? `p:${link.item.id}` : `t:${plain.toLowerCase()}`;
      const row = rows.get(key);
      if (row) {
        if (!row.recipeTitles.includes(recipe.title)) row.recipeTitles.push(recipe.title);
        // Needed more than once (two recipes, or twice in one): one row, by
        // the pantry's name ("Onion"), as one line's amount would be too
        // little (review, 2026-11-08).
        if (link.item) row.text = link.item.name;
      } else {
        rows.set(key, {
          key,
          text: plain,
          pantryItem: link.item,
          recipeTitles: [recipe.title],
          recipeId: recipe.id,
        });
      }
    }
  }
  return [...rows.values()];
}

// Ticked to start with: everything except what the pantry says we have.
// Lines not in the pantry are ticked too, since Bento can't tell.
export function startsTicked(row: GatheredRow): boolean {
  return row.pantryItem?.status !== "have";
}

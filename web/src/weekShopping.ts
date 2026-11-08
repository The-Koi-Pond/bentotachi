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

// How a recipe line reads on the shopping list: the recipe's own words
// (amount and kind: "12 oz gluten free linguine pasta", not the pantry's
// "Pasta"; Xel, 2026-11-08), without how to prepare it, which follows the
// first ", " ("2 onions, diced" -> "2 onions"; "to serve" goes too). A
// comma with no space is a decimal ("1,5 kg") and stays.
export function listWording(line: string): string {
  const plain = withoutSoftMarks(line).trim();
  const cut = plain.indexOf(", ");
  return (cut > 0 ? plain.slice(0, cut) : plain).trim();
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
        // Needed by two recipes in different words: one row, by the
        // pantry's name ("Onion").
        if (link.item && row.text !== plain) row.text = link.item.name;
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

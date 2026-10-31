// Gathers the ingredients of several planned dinners into one shopping
// list: lines linked to the same pantry item merge into one row ("Onion",
// for two recipes), lines marked "not a pantry item" (like water) are left
// out, and each row says whether it's worth buying.

import { headingOf } from "./format.ts";
import { linkFor } from "./pantryLinks.ts";
import type { PantryItem, Recipe } from "./pb";

export interface GatheredRow {
  // Unique per row: "p:<pantry id>" or "t:<line in lowercase>".
  key: string;
  // What goes on the shopping list: the pantry name, or the recipe's line.
  text: string;
  pantryItem: PantryItem | null;
  // The dinners that need it, in plan order, without repeats.
  recipeTitles: string[];
  // The first recipe that needs it, for the shopping item's "for" note.
  recipeId: string;
}

export function gatherIngredients(dinners: Recipe[], pantry: PantryItem[]): GatheredRow[] {
  const rows = new Map<string, GatheredRow>();
  for (const recipe of dinners) {
    for (const line of recipe.ingredients ?? []) {
      if (headingOf(line) !== null || !line.trim()) continue;
      const link = linkFor(line, recipe.ingredient_links, pantry);
      if (link.kind === "notPantry") continue;
      const key = link.item ? `p:${link.item.id}` : `t:${line.trim().toLowerCase()}`;
      const row = rows.get(key);
      if (row) {
        if (!row.recipeTitles.includes(recipe.title)) row.recipeTitles.push(recipe.title);
      } else {
        rows.set(key, {
          key,
          text: link.item ? link.item.name : line.trim(),
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

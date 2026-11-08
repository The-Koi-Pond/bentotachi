// Gathers the ingredients of several planned dinners into one shopping
// list: lines linked to the same pantry item merge into one row ("Onion",
// for two recipes), lines marked "not a pantry item" (like water) are left
// out, and each row says whether it's worth buying.

import { headingOf } from "./format.ts";
import { familyStatus, linkFor, linkTarget, type Family } from "./pantryLinks.ts";
import { coversFor, stillToBuy, worthBuying, type Cover } from "./pantryStock.ts";
import { withoutSoftMarks } from "./softMarks.ts";
import { recipeMeasures, type RecipeMeasures } from "./volumes.ts";
import type { PantryItem, PantryPacket, PantryStatus, Recipe } from "./pb";

export interface GatheredRow {
  // Unique per row: "p:<pantry id>", "p:kind:<group>" or "t:<line in
  // lowercase>".
  key: string;
  // What goes on the shopping list: the recipe's words (listWording), or
  // the pantry's name when several recipes need it in different words.
  text: string;
  pantryItem: PantryItem | null;
  // The group when any kind of it will do ("Pasta"; pantryLinks.ts). Such
  // a row goes on the list unlinked: buying it can't say which kind.
  family: Family | null;
  // The dinners that need it, in plan order, without repeats.
  recipeTitles: string[];
  // The first recipe that needs it, for the shopping item's "for" note.
  recipeId: string;
  // What the pantry's packets cover of it (pantryStock.ts).
  cover: Cover;
}

// A part after a comma is how to prepare the thing, not another thing to
// buy, when every word in it is a preparation word ("diced", "finely
// chopped", "peeled and diced"), or it starts with one of LEADS ("to serve",
// "plus extra for dusting", "at room temperature", "cut into chunks").
// "Toasted sesame seeds" or "freshly ground black pepper" have other words,
// so they stay.
const PREPARATION = new Set(
  (
    "diced chopped sliced minced grated shredded crushed peeled cubed halved quartered julienned trimmed " +
    "rinsed drained beaten whisked softened melted cooled chilled divided optional juiced zested seeded " +
    "deseeded cored pitted toasted roasted cooked uncooked thawed defrosted torn picked washed separated " +
    "mashed squeezed stemmed sifted packed heaped scrubbed deveined patted dry finely roughly thinly " +
    "coarsely freshly lightly very well and or then cut into chunks pieces rounds rings strips wedges " +
    "cubes slices halves thin thick small large bite-sized"
  ).split(" ")
);
const LEADS = new Set("to for plus at if such cut preferably ideally".split(" "));

// Asides in brackets ("diced (about 1 cup)", "chopped (optional)") and a
// closing full stop don't make preparation into something to buy.
function isPreparation(part: string): boolean {
  const words = part
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[.;:!]+\s*$/, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return false;
  return LEADS.has(words[0]) || words.every((word) => PREPARATION.has(word));
}

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
// "Pasta"), without how to prepare it ("2 onions, diced" ->
// "2 onions", "Feta, to serve" -> "Feta"). Only preparation goes: "Salt,
// pepper" and "2 carrots, 2 celery sticks" keep every thing to buy, and
// commas in brackets or decimals ("1,5 kg") don't count.
export function listWording(line: string): string {
  const parts = partsOf(withoutSoftMarks(line).trim());
  while (parts.length > 1 && isPreparation(parts[parts.length - 1])) parts.pop();
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

// `packets`: the pantry's packets in stock, so a row asks only for what's
// short (a row of one line shows the reduced amount; a merged row keeps the
// pantry's name and says whether there's enough).
export function gatherIngredients(
  dinners: Recipe[],
  pantry: PantryItem[],
  packets: Pick<PantryPacket, "id" | "item" | "brand" | "size" | "created">[] = []
): GatheredRow[] {
  const rows = new Map<string, GatheredRow>();
  const needs = new Map<string, { line: string; measures: RecipeMeasures }[]>();
  for (const recipe of dinners) {
    const measures = recipeMeasures(recipe.source_url ?? "");
    for (const line of recipe.ingredients ?? []) {
      if (headingOf(line) !== null || !line.trim()) continue;
      const link = linkFor(line, recipe.ingredient_links, pantry);
      if (link.kind === "notPantry") continue;
      // As when adding from the recipe page (listWording), so the list's
      // duplicate check sees the same words.
      const plain = listWording(line);
      const target = linkTarget(link);
      const key = target ? `p:${target}` : `t:${plain.toLowerCase()}`;
      // Measured on the whole line, as the recipe page does: "Parmesan,
      // finely grated (about 50 g)" says how much only after the comma.
      needs.set(key, [...(needs.get(key) ?? []), { line, measures }]);
      const row = rows.get(key);
      if (row) {
        if (!row.recipeTitles.includes(recipe.title)) row.recipeTitles.push(recipe.title);
        // Needed more than once (two recipes, or twice in one): one row, by
        // the pantry's name ("Onion", or "Pasta" for any kind), as one
        // line's amount would be too little.
        const name = link.item?.name ?? link.family?.name;
        if (name) row.text = name;
      } else {
        rows.set(key, {
          key,
          text: plain,
          pantryItem: link.item,
          family: link.family,
          recipeTitles: [recipe.title],
          recipeId: recipe.id,
          cover: { kind: "unknown" },
        });
      }
    }
  }
  const linked = [...rows.values()].filter((row) => row.pantryItem || row.family);
  const covers = coversFor(
    linked.map((row) => ({
      key: row.key,
      items: row.pantryItem ? [row.pantryItem] : (row.family?.items ?? []),
      needs: needs.get(row.key) ?? [],
      anyKind: !!row.family,
    })),
    packets
  );
  for (const row of linked) {
    row.cover = covers.get(row.key) ?? row.cover;
    if ((needs.get(row.key) ?? []).length === 1) row.text = stillToBuy(row.text, row.cover);
  }
  return [...rows.values()];
}

// A row's level: its pantry item's, or its group's (any kind will do), or
// null when it isn't in the pantry.
export function rowStatus(row: Pick<GatheredRow, "pantryItem" | "family">): PantryStatus | null {
  return row.pantryItem?.status ?? (row.family ? familyStatus(row.family.items) : null);
}

// Ticked to start with: what's worth buying (worthBuying). Lines not in the
// pantry are ticked too, since Bentotachi can't tell.
export function startsTicked(row: GatheredRow): boolean {
  const status = rowStatus(row);
  return worthBuying(status ? { status } : null, row.cover);
}

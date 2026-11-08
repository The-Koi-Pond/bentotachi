// Linking recipe ingredient lines to pantry items.
//
// Bento guesses: a pantry item matches a line if its name appears in it
// (see wordMatch.ts: whole words, plurals allowed, "rice vinegar" isn't
// Rice), or the other region's name for it does ("Capsicum" matches "1 red
// bell pepper"; see regionalNames.ts). The longest matching name wins
// ("Chicken stock" beats "Chicken"). People can override a guess for a
// recipe; those choices are stored on the recipe as ingredient_links, keyed
// by the line's text, and always win over guesses.
//
// Kinds of one thing (Linguine, Penne: each "a kind of Pasta", kind_of on
// the item; docs/PLAN.md): a line naming a kind links to that kind only; a
// line naming just the group ("500 g pasta") links to the group, and any
// kind in it will do. Stored as "kind:Pasta" in ingredient_links.

import { headingOf } from "./format.ts";
import type { PantryItem, PantryStatus, Recipe } from "./pb";
import { findMention, mentions, stem } from "./wordMatch.ts";
import { otherNames } from "./regionalNames.ts";
import { worthBuying, type Cover } from "./pantryStock.ts";
import { withoutSoftMarks } from "./softMarks.ts";

// A group of kinds: its name as people typed it, and the items in it.
export interface Family {
  name: string;
  items: PantryItem[];
}

export type IngredientLink =
  | { kind: "chosen" | "guessed"; item: PantryItem; family: null }
  | { kind: "chosen" | "guessed"; item: null; family: Family }
  | { kind: "notPantry" | "unmatched"; item: null; family: null };

const FAMILY_LINK = "kind:";

// What ingredient_links stores for "any kind of this will do".
export const familyLinkValue = (name: string) => `${FAMILY_LINK}${name.trim()}`;

// The groups the pantry's items form, by their kind_of, keyed in lower case.
export function familiesOf(items: PantryItem[]): Map<string, Family> {
  const families = new Map<string, Family>();
  for (const item of items) {
    const name = (item.kind_of ?? "").trim();
    if (!name) continue;
    const family = families.get(name.toLowerCase()) ?? { name, items: [] };
    family.items.push(item);
    families.set(name.toLowerCase(), family);
  }
  return families;
}

// A group's level, as one: Have if any kind is had, else Low if any is low,
// else Out.
export function familyStatus(items: Pick<PantryItem, "status">[]): PantryStatus {
  if (items.some((item) => item.status === "have")) return "have";
  return items.some((item) => item.status === "low") ? "low" : "out";
}

// The level of what a line is linked to, or null when it isn't linked.
export function linkStatus(link: IngredientLink): PantryStatus | null {
  if (link.item) return link.item.status;
  return link.family ? familyStatus(link.family.items) : null;
}

// The pantry items a link covers: its item, or every kind in its group.
export function linkedItems(link: IngredientLink): PantryItem[] {
  return link.item ? [link.item] : (link.family?.items ?? []);
}

// One key per thing linked to (an item's id, or "kind:pasta"), so lines
// linked to the same thing can be gathered together.
export function linkTarget(link: IngredientLink): string {
  if (link.item) return link.item.id;
  return link.family ? familyLinkValue(link.family.name.toLowerCase()) : "";
}

// Words that may come right before a group's name in a line that means
// "any kind" ("500 g dried pasta", "a packet of pasta"). Any other word
// there is likely a kind ("bucatini pasta", "basmati rice"), so the line
// isn't taken as "any".
const ANY_KIND_BEFORE = new Set(
  "a an of your any some dried fresh cooked uncooked short long small large medium favourite favorite leftover extra".split(" ") // not on screen
);
// An amount or its unit, beyond AMOUNT_WORDS: one written together ("500g",
// "1.5kg", "8oz"), a count ("2 x"), and packaging.
const AMOUNT_BEFORE = /^(\d+([.,]\d+)?(g|kg|ml|l|oz|lbs?)|x|×|kilos?|pounds?|packs?|bags?|box(es)?|jars?|bottles?)$/;

// The group a line names, when no kind or other item is named in it: at
// the start of the line (formatting marks aside), or after an amount or a
// describing word. That word is read without punctuation ("(225g)", "lb.")
// and after a "/" ("500g/1lb"); a word that's all punctuation ("orzo
// (pasta)", "bucatini/pasta") isn't one, so the line isn't taken as "any".
function guessFamily(line: string, items: PantryItem[]): Family | null {
  const text = withoutSoftMarks(line);
  for (const family of familiesOf(items).values()) {
    const at = findMention(text, family.name);
    if (!at) continue;
    const ahead = text.slice(0, at.start).trim().toLowerCase();
    if (!ahead) return family;
    const before = (ahead.split(/[\s/]+/).pop() ?? "").replace(/^[^\p{L}\d½¼¾⅓⅔⅛]+|[^\p{L}\d½¼¾⅓⅔⅛]+$/gu, "");
    if (before && (ANY_KIND_BEFORE.has(before) || AMOUNT_WORDS.test(before) || AMOUNT_BEFORE.test(before))) return family;
  }
  return null;
}

const norm = (text: string) => text.trim().toLowerCase();

// The line's key in ingredient_links. On purpose its own rule, not a shared
// text helper: saved links are found by it, so it must never change.
export const linkKey = norm;

// The pantry item whose name (or its other region's name) appears in the
// line, or null.
export function guessPantryItem(line: string, items: PantryItem[]): PantryItem | null {
  let best: PantryItem | null = null;
  let bestLength = 0;
  for (const item of items) {
    // An item named as its own group ("Pasta", a kind of Pasta) stands for
    // the whole group, which guessFamily finds.
    if (item.kind_of && norm(item.kind_of) === norm(item.name)) continue;
    const length = stem(item.name).length;
    if (!length || length <= bestLength) continue;
    if (![item.name, ...otherNames(item.name)].some((name) => mentions(line, name))) continue;
    best = item;
    bestLength = length;
  }
  return best;
}

// Whether a recipe line is worth buying (worthBuying, pantryStock.ts), for
// "Missing from pantry". Never lines marked "not a pantry item" (water).
export function missingFromPantry(link: IngredientLink, cover: Cover = { kind: "unknown" }): boolean {
  const status = linkStatus(link);
  return link.kind !== "notPantry" && worthBuying(status ? { status } : null, cover);
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
    if (!id) return { kind: "notPantry", item: null, family: null };
    if (id.startsWith(FAMILY_LINK)) {
      const family = familiesOf(items).get(id.slice(FAMILY_LINK.length).toLowerCase());
      if (family) return { kind: "chosen", item: null, family };
      // No kinds of it left in the pantry: fall back to a guess.
    } else {
      const item = items.find((i) => i.id === id);
      if (item) return { kind: "chosen", item, family: null };
      // The chosen item has been deleted from the pantry: fall back to a guess.
    }
  }
  const guess = guessPantryItem(line, items);
  if (guess) return { kind: "guessed", item: guess, family: null };
  const family = guessFamily(line, items);
  return family ? { kind: "guessed", item: null, family } : { kind: "unmatched", item: null, family: null };
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
    const link = linkFor(line, recipe.ingredient_links, items);
    const status = linkStatus(link);
    if (!status) continue;
    linked += 1;
    if (status === "out") for (const item of linkedItems(link)) out.set(item.id, item);
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

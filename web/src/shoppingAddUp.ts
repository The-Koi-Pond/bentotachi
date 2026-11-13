// Adding up the same thing on the shopping list: "3 garlic cloves" waiting
// and "2 garlic cloves" from another recipe become "5 garlic cloves". When
// unsure, two lines stay two lines: a merge must never leave the list
// asking for less than the recipes need. docs/PLAN.md, "Next up: from a
// tester's report". Tested in test/shoppingAddUp.test.ts.
import { leadingAmount, scaleLine } from "./scaling.ts";
import { linkedApart, sameThing } from "./shoppingMatch.ts";
import { foldText, stem } from "./wordMatch.ts";

// One recipe's part of a line on the list: which recipe (its id, "" once
// it's deleted or for a thing typed in; its title when added) and its own
// words for it ("3 garlic cloves").
export interface Share {
  recipe: string;
  title: string;
  text: string;
}

// Each unit as its kind and how many of the smallest of that kind it is:
// grams and kilos add up, a cup and grams don't.
const UNIT_KINDS: [RegExp, string, number][] = [
  [/^(?:g|gr|grams?)$/i, "g", 1],
  [/^(?:kgs?|kilos?|kilograms?)$/i, "g", 1000],
  [/^(?:ml|millilit(?:re|er)s?)$/i, "ml", 1],
  [/^cl$/i, "ml", 10],
  [/^dl$/i, "ml", 100],
  [/^(?:l|lit(?:re|er)s?)$/i, "ml", 1000],
  [/^(?:teaspoons?|tsps?\.?|tl|theelepels?)$/i, "tsp", 1],
  [/^(?:tablespoons?|tbsps?\.?|tbs\.?|tbl\.?|el|eetlepels?)$/i, "tbsp", 1],
  [/^cups?$/i, "cup", 1],
  [/^(?:fl\.?\s*oz\.?|fluid\s+ounces?)$/i, "fl oz", 1],
  [/^(?:oz\.?|ounces?)$/i, "oz", 1],
  [/^(?:lbs?\.?|pounds?)$/i, "lb", 1],
  [/^(?:pints?|pt\.?)$/i, "pint", 1],
  [/^(?:quarts?|qts?\.?)$/i, "quart", 1],
  [/^(?:gallons?|gal\.?)$/i, "gallon", 1],
];

function unitKind(unit: string): { kind: string; size: number } {
  const found = UNIT_KINDS.find(([pattern]) => pattern.test(unit));
  return found ? { kind: found[1], size: found[2] } : { kind: unit.toLowerCase(), size: 1 };
}

// What a count counts when it isn't the thing itself: "2 cloves garlic",
// "1 (400 g) can tomatoes". A size before one of these is the container's
// ("1 small can"), and stays part of what it is.
const CONTAINERS = new Set(
  (
    "clove can tin jar bunch sprig stick stalk head bulb packet pack pkg bag bottle slice piece sheet rib knob handful " +
    "pinch dash leaf sachet punnet fillet rasher cube block box carton loaf tub tube"
  ).split(" ")
);
// Words that say how big, not what: "1 large onion" is an onion.
const SIZES = new Set("large medium small big jumbo".split(" "));

// The words of `text`, folded ("Crème" -> "creme"), as written.
function wordsOf(text: string): string[] {
  return foldText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// A line read for adding up: its amount in its unit kind's smallest unit,
// that kind ("" for a count), the line's own amount, the sizes it gives on
// their own ("large" in "1 large onion"), and what it is as a key that
// ignores order, plurals and those sizes ("clove garlic").
interface Quantity {
  text: string;
  amount: number;
  kind: string;
  size: number;
  own: number;
  sizes: string;
  key: string;
}

const read = new Map<string, Quantity | null>();

function quantityOf(text: string): Quantity | null {
  const known = read.get(text);
  if (known !== undefined) return known;
  // Read once per wording: a week's dinners compare every line with every
  // row (gatherIngredients, plannedAdds).
  if (read.size > 2000) read.clear();
  const quantity = readQuantity(text.trim());
  read.set(text, quantity);
  return quantity;
}

function readQuantity(text: string): Quantity | null {
  const lead = leadingAmount(text);
  if (!lead) return null;
  // The bracket closing an amount given another way ("1/2 cup (100 g"), or
  // a count's pack size ("1 (400 g) can"), which is part of what it is.
  let rest = lead.unit ? lead.rest.replace(/^\s*\)/, "") : lead.rest;
  const pack = lead.unit ? null : rest.match(/^\s*\([^()]*\)/);
  if (pack) rest = rest.slice(pack[0].length);
  // Another number further on (a punnet's count, a swap's amount) wouldn't
  // change with the total: such a line doesn't add up.
  if (/\d/.test(rest)) return null;
  const words = wordsOf(rest);
  const sizes: string[] = [];
  const kept = words.filter((word, index) => {
    if (word === "of") return false;
    if (SIZES.has(word) && !CONTAINERS.has(stem(words[index + 1] ?? ""))) {
      sizes.push(word);
      return false;
    }
    return true;
  });
  if (!kept.length) return null;
  const key = [...(pack ? wordsOf(pack[0]) : []), ...kept.map(stem).sort()].join(" ");
  const unit = lead.unit ? unitKind(lead.unit) : { kind: "", size: 1 };
  return { text, amount: lead.amount * unit.size, kind: unit.kind, size: unit.size, own: lead.amount, sizes: sizes.sort().join(" "), key };
}

// "onion" -> "onions", "pinch" -> "pinches", "leaf" -> "leaves".
function plural(word: string): string {
  if (/^(?:leaf|loaf|half)$/i.test(word)) return word.slice(0, -1) + "ves";
  if (/(?:s|x|z|ch|sh)$/i.test(word) || /^(?:tomato|potato)$/i.test(word)) return word + "es";
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  return word + "s";
}

// A count's line once there's more than one: the container made plural
// when there is one ("2 cloves garlic", "2 (400 g) cans tomatoes"),
// otherwise the thing's last word ("2 onions", "2 garlic cloves"); not a
// word that isn't a thing ("2 lemons juiced" can't be guessed: left).
function countedPlural(line: string): string {
  const lead = leadingAmount(line);
  if (!lead) return line;
  const start = line.length - lead.rest.length;
  const pack = lead.rest.match(/^\s*\([^()]*\)/);
  const from = start + (pack ? pack[0].length : 0);
  const name = line.slice(from).match(/^(\s*)([^,(]*)/);
  if (!name) return line;
  const words = [...name[2].matchAll(/\p{L}+/gu)];
  const target = words.find((word) => CONTAINERS.has(stem(word[0]))) ?? words.at(-1);
  if (!target || target.index === undefined) return line;
  const word = target[0];
  if (stem(word) !== word.toLowerCase() || /(?:ed|ly|ing)$/i.test(word)) return line;
  const at = from + name[1].length + target.index;
  return line.slice(0, at) + plural(word) + line.slice(at + word.length);
}

// Two lines as one, added up ("3 garlic cloves" and "2 garlic cloves" ->
// "5 garlic cloves", "1 onion" and "1 large onion" -> "2 onions", "500 g
// potatoes" and "1 kg potatoes" -> "1.5 kg potatoes"), in the words of one
// of them, brackets and all ("2 (400 g) cans tomatoes"). null when they
// aren't the same thing ("flour (plain)" and "flour (self-raising)", a 400 g
// and an 800 g can), or don't add up to one amount ("1 cup flour" and "200
// g flour", "Salt" and "1 tsp salt", "2-3 onions").
export function addedUp(a: string, b: string): string | null {
  const first = quantityOf(a);
  const second = quantityOf(b);
  if (!first || !second || first.key !== second.key || first.kind !== second.kind) return null;
  // Written as the one in the bigger unit ("1.5 kg", not "1500 g"), or for
  // a count the one already plural ("1 egg" and "2 eggs" -> "3 eggs"), else
  // the one with no size ("2 onions", not "2 large onions").
  const base = first.kind
    ? second.size > first.size
      ? second
      : first
    : (first.own <= 1 && second.own > 1) || (first.sizes && !second.sizes)
      ? second
      : first;
  const total = first.amount + second.amount;
  // Sizes that differ ("1 small onion" and "1 large onion") are left out,
  // not given to both: each recipe's own words stay behind the book.
  const words =
    first.sizes === second.sizes
      ? base.text
      : base.text.replace(/\b(large|medium|small|big|jumbo)\s+(\p{L}+)/giu, (both, _size, next: string) =>
          CONTAINERS.has(stem(next)) ? both : next
        );
  const scaled = scaleLine(words, total / base.amount);
  return !base.kind && base.own <= 1 && total > 1 ? countedPlural(scaled) : scaled;
}

// A line's shares: its own, or for a line from before shares, one made
// from it (its recipe, or none when it was typed in).
export function sharesOf(row: { text: string; recipe: string; shares: Share[] | null; expand?: { recipe?: { title: string } } }): Share[] {
  if (row.shares?.length) return row.shares;
  return [{ recipe: row.recipe, title: row.expand?.recipe?.title ?? "", text: row.text }];
}

// Something to put on the list: its words, its pantry item ("" for none)
// and the recipes it's for.
export interface Thing {
  text: string;
  pantryItem: string;
  shares: Share[];
}

// A line already waiting on the list.
export interface Waiting {
  id: string;
  text: string;
  pantryItem: string;
  shares: Share[];
}

export type Step =
  | { create: { text: string; pantryItem: string; shares: Share[] } }
  | { update: { id: string; text: string; pantryItem: string; shares: Share[] } };

// All of these lines as one, or null if any doesn't add up with the rest.
function totalOf(lines: string[]): string | null {
  let total: string | null = lines[0] ?? null;
  for (const line of lines.slice(1)) total = total && addedUp(total, line);
  return total;
}

// What adding these things does, in order: each one goes onto the line
// waiting for the same thing (sameThing, or addedUp works) and adds up into
// it, or becomes a new line.
//  - A recipe's share already on the line in the same words is counted
//    already (adding a recipe again, trying again after an error).
//  - In other words (the recipe added again at another size), it takes
//    the place of the old one, when the line's shares add up to a total.
//  - Two lines of one recipe in one go do add up.
// `addedUp` counts things that changed the amount of a line already there,
// `skipped` the ones that were on it already.
export function plannedAdds(things: Thing[], waiting: Waiting[]): { steps: Step[]; added: number; addedUp: number; skipped: number } {
  const rows = waiting.map((row) => ({ ...row, before: row.shares.filter((share) => share.recipe), step: -1 }));
  const steps: Step[] = [];
  let added = 0;
  let summed = 0;
  let skipped = 0;
  for (const thing of things) {
    const row = rows.find(
      (row) =>
        sameThing(thing, { text: row.text, pantry_item: row.pantryItem }) ||
        (!linkedApart(thing, { pantry_item: row.pantryItem }) && addedUp(row.text, thing.text) !== null)
    );
    if (!row) {
      steps.push({ create: { text: thing.text, pantryItem: thing.pantryItem, shares: thing.shares } });
      rows.push({ id: "", text: thing.text, pantryItem: thing.pantryItem, shares: thing.shares, before: [], step: steps.length - 1 });
      added++;
      continue;
    }
    const fresh = thing.shares.filter((share) => {
      const counted = row.before.findIndex((old) => old.recipe === share.recipe && old.text === share.text);
      if (counted < 0) return true;
      row.before.splice(counted, 1);
      return false;
    });
    if (!fresh.length) {
      skipped++;
      continue;
    }
    const was = row.text;
    const replaced = fresh.length === 1 && row.before.some((old) => old.recipe === fresh[0].recipe);
    const shares = replaced ? [...row.shares.filter((share) => !row.before.includes(share) || share.recipe !== fresh[0].recipe), fresh[0]] : null;
    const total = shares && totalOf(shares.map((share) => share.text));
    if (shares && total) {
      row.before = row.before.filter((old) => old.recipe !== fresh[0].recipe);
      row.shares = shares;
      row.text = total;
    } else {
      // All of it new: its own words, which may be less what the pantry
      // has, and may be the pantry's name with no amount ("Onion", from the
      // plan's week), which adds nothing. Partly new: the new parts.
      const parts = fresh.length === thing.shares.length ? [thing.text] : fresh.map((share) => share.text);
      for (const part of parts) row.text = addedUp(row.text, part) ?? row.text;
      row.shares = [...row.shares, ...fresh];
    }
    // Bought, it marks the pantry item Have, as the line it joined would.
    if (!row.pantryItem && thing.pantryItem) row.pantryItem = thing.pantryItem;
    if (row.id) {
      if (row.text !== was) summed++;
      else skipped++;
    }
    const line = { text: row.text, pantryItem: row.pantryItem, shares: row.shares };
    if (row.step < 0) {
      steps.push({ update: { id: row.id, ...line } });
      row.step = steps.length - 1;
    } else {
      const step = steps[row.step];
      steps[row.step] = "create" in step ? { create: line } : { update: { id: step.update.id, ...line } };
    }
  }
  return { steps, added, addedUp: summed, skipped };
}

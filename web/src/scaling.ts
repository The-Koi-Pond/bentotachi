// Scaling a recipe: "Makes 4" turned up to 6 multiplies each ingredient's
// amount by 1.5. Only amounts are changed, never sizes or the method:
//  - The amount a line starts with: "2 cups flour" -> "3 cups flour",
//    "1-2 cloves garlic" -> "1½-3 cloves garlic".
//  - The same amount given another way right after it, or more of it added
//    on: "250 g/8 oz butter", "1 cup (250 ml) milk", "½ cup + 2 tbsp",
//    "1 cup plus 2 tablespoons (255 g)".
//  - Not a size after a count: "1 (400 g) can tomatoes", "2 x 400 g cans".
//  - "Juice of 1 lemon", "zest of 2 limes": the fruit, with its plural.
//  - A line with no amount at the start gets its first measured amount
//    scaled: "Butter, 250 g".
// Cups, spoons and counts come out as kitchen fractions (1½, ⅓), grams and
// millilitres as round numbers. Unit words follow the amount ("1 cup",
// "2 cups"); other words don't ("2 egg" stays possible, as in Paprika).

import { NUMBER, dotMeansThousands, parseNumber } from "./weights.ts";

const RANGE = String.raw`(${NUMBER})(?:(\s*(?:-|–|to)\s*)(${NUMBER}))?`;
// Dutch recipes too: dl and cl, el (eetlepel, tablespoon), tl (theelepel,
// teaspoon).
const UNITS = String.raw`kgs?|kilos?|kilograms?|grams?|gr|g|ml|millilit(?:re|er)s?|dl|cl|l|lit(?:re|er)s?|cups?|tablespoons?|tbsps?\.?|tbs\.?|tbl\.?|teaspoons?|tsps?\.?|el|eetlepels?|tl|theelepels?|fl\.?\s*oz\.?|fluid\s+ounces?|lbs?\.?|pounds?|oz\.?|ounces?|pints?|pt\.?|quarts?|qts?\.?|gallons?|gal\.?`;
const UNIT_AFTER = new RegExp(String.raw`^(\s*-?\s*)(${UNITS})(?![a-z])`, "i");
// Soft marks or bullet-ish characters may come before the amount.
const LEADING = new RegExp(String.raw`^([\s*_•·-]*)${RANGE}`);
// The same amount another way, or more added on: "/8 oz", " (250 ml",
// " or 1 cup", " + 2 tbsp", " plus 2 tablespoons", " and 1 tsp",
// ", plus 2 tbsp".
const ALTERNATIVE = new RegExp(
  String.raw`^(\s*(?:,\s*(?:plus|and)\s|\/|\(|\+|or\s|plus\s|and\s|,)?\s*)${RANGE}(\s*-?\s*)(${UNITS})(?![a-z])`,
  "i"
);
// "Juice of 1 lemon", "zest of 1 large unwaxed orange", "Finely grated zest
// and juice of 2 oranges": a citrus fruit, maybe with words like "large"
// before it (which stay as they are). Groups: "juice of ", the count (and
// a range), the space, the words before the fruit, the fruit.
const FRUIT = String.raw`(lemon|lime|orange|grapefruit|mandarin|clementine|tangerine|yuzu)s?(?![a-z])`;
const FRUIT_PART = new RegExp(
  String.raw`\b((?:juice|zest|rind)(?:\s+and\s+(?:juice|zest|rind))?\s+of\s+)${RANGE}(\s+)((?:[a-z-]+\s+){0,3}?)${FRUIT}`,
  "i"
);
// (The empty group stands where LEADING's prefix is, so both read alike.)
const MEASURED = new RegExp(String.raw`(?<!\d)(?<!\d[.,])()${RANGE}(\s*-?\s*)(${UNITS})(?![a-z])`, "i");
const LEADING_MEASURED = new RegExp(String.raw`^([\s*_•·-]*)${RANGE}(\s*-?\s*)(${UNITS})(?![a-z])`, "i");
// Right before a measure: a count of it ("2 x ", "(2 × ", "2 (", "2 cans (").
// Right after it: more of it added on ("8 oz", " + 2 tbsp", " plus 2
// tablespoons").
const SEVERAL_OF = new RegExp(String.raw`${NUMBER}\s*(?:[x×]|\(|[a-z]+\s*\()\s*$`, "i");
const ADDED_ON = new RegExp(String.raw`^\s*(?:,\s*)?(?:\+|plus\s|and\s)?\s*${NUMBER}\s*-?\s*(?:${UNITS})(?![a-z])`, "i");

const METRIC = /^(?:kgs?|kilos?|kilograms?|grams?|gr|g|ml|millilit(?:re|er)s?|dl|cl|l|lit(?:re|er)s?)$/i;
const BIG_METRIC = /^(?:kgs?|kilos?|kilograms?|l|lit(?:re|er)s?)$/i;

// Whole unit words that change with the amount.
const PLURAL_UNITS: Record<string, string> = {
  cup: "cups",
  tablespoon: "tablespoons",
  teaspoon: "teaspoons",
  pound: "pounds",
  ounce: "ounces",
  pint: "pints",
  quart: "quarts",
  gallon: "gallons",
  kilo: "kilos",
  kilogram: "kilograms",
  gram: "grams",
  litre: "litres",
  liter: "liters",
  millilitre: "millilitres",
  milliliter: "milliliters",
};

const FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [1, ""],
];

// 1.5 -> "1½", 0.33 -> "⅓", 0.125 -> "⅛": the nearest quarter or third
// (an eighth is the smallest).
export function kitchenFraction(n: number): string {
  if (n < 0.19) return "⅛";
  let whole = Math.floor(n);
  let best = FRACTIONS[0];
  for (const option of FRACTIONS) if (Math.abs(n - whole - option[0]) < Math.abs(n - whole - best[0])) best = option;
  if (best[0] === 1) whole += 1;
  return whole ? `${whole}${best[1]}` : best[1];
}

// Grams and millilitres the way a scale or jug shows them: "375", "190",
// "8"; kilos and litres to two decimals: "1.25".
function metricAmount(n: number, unit: string): string {
  if (BIG_METRIC.test(unit)) return String(Math.round(n * 100) / 100);
  if (n >= 50) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

function scaledAmount(text: string, factor: number, unit: string): string {
  const n = parseNumber(text, unit) * factor;
  // Written with a decimal comma ("1,5 kg", "1.250,5 g"): the answer gets
  // one too.
  const comma = /^\d+,\d{1,2}$/.test(text.trim()) || /\.\d{3},\d/.test(text);
  const decimals = (s: string) => (comma ? s.replace(".", ",") : s);
  if (unit && METRIC.test(unit.trim())) return decimals(metricAmount(n, unit.trim()));
  // Written with decimals: keep them ("1.5 cups" -> "2.25 cups"). (Not a
  // Dutch thousands dot, "1.000 g".)
  if (comma || (/\.\d/.test(text) && !dotMeansThousands(text.trim(), unit))) return decimals(String(Math.round(n * 100) / 100));
  return kitchenFraction(n);
}

// "1-1/2" is one and a half, not 1 to ½ (as weights.ts reads it).
function isMixedNumber(low: string, high: string | undefined, unit: string): boolean {
  return high !== undefined && parseNumber(high, unit) < parseNumber(low, unit) && parseNumber(high, unit) < 1;
}

// `last` is the (last) amount as shown, read back from the text, so the
// unit after it agrees: 1.125 cups shows as "1", so "1 cup", not "1 cups".
function scaledRange(low: string, separator: string | undefined, high: string | undefined, factor: number, unit: string) {
  if (high === undefined || isMixedNumber(low, high, unit)) {
    const amount = high === undefined ? low : String(parseNumber(low, unit) + parseNumber(high, unit));
    const text = scaledAmount(amount, factor, unit);
    return { text, last: parseNumber(text, unit) };
  }
  const highText = scaledAmount(high, factor, unit);
  return { text: `${scaledAmount(low, factor, unit)}${separator}${highText}`, last: parseNumber(highText, unit) };
}

// "cup" for one, "cups" for more, keeping the unit's capital letter.
function unitFor(unit: string, amount: number): string {
  const lower = unit.toLowerCase();
  const singular = Object.keys(PLURAL_UNITS).find((s) => s === lower || PLURAL_UNITS[s] === lower);
  if (!singular) return unit;
  const word = amount > 1 ? PLURAL_UNITS[singular] : singular;
  return unit[0] === unit[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
}

// The amount and unit at the start of `text`, then any alternatives right
// after; returns the scaled text up to where it stopped, and the rest.
function scaleMeasured(text: string, factor: number, pattern: RegExp): [string, string] | null {
  const match = text.match(pattern);
  if (!match) return null;
  const [whole, before, low, separator, high, gap, unit] = match;
  const { text: amount, last } = scaledRange(low, separator, high, factor, unit);
  let done = `${text.slice(0, match.index)}${before}${amount}${gap}${unitFor(unit, last)}`;
  let rest = text.slice((match.index ?? 0) + whole.length);
  for (let alt = rest.match(ALTERNATIVE); alt; alt = rest.match(ALTERNATIVE)) {
    const [altWhole, altBefore, altLow, altSeparator, altHigh, altGap, altUnit] = alt;
    const scaled = scaledRange(altLow, altSeparator, altHigh, factor, altUnit);
    done += `${altBefore}${scaled.text}${altGap}${unitFor(altUnit, scaled.last)}`;
    rest = rest.slice(altWhole.length);
  }
  return [done, rest];
}

export function scaleLine(line: string, factor: number): string {
  if (factor === 1) return line;
  // "Juice of 1 lemon" -> "Juice of 2 lemons", with the amounts before it
  // ("3 tbsp olive oil and ...") and after it ("(about 2 tbsp)") scaled too.
  const fruit = line.match(FRUIT_PART);
  if (fruit) {
    const start = fruit.index ?? 0;
    const rest = line.slice(start + fruit[0].length);
    const after = scaleMeasured(rest, factor, MEASURED);
    return `${scaleBeforeFruit(line.slice(0, start), factor)}${scaledFruit(fruit, factor)}${after ? after[0] + after[1] : rest}`;
  }
  return scaleAmounts(line, factor);
}

// "Zest of 1 and juice of 2 lemons": the first count belongs to the same
// fruit, so it's right before the fruit part.
const OTHER_PART = new RegExp(String.raw`\b((?:juice|zest|rind)\s+of\s+)${RANGE}(\s+and\s+(?:the\s+)?)$`, "i");

// What comes before the fruit part: another count of the same fruit, and
// any amounts before that ("3 tbsp olive oil and ...").
function scaleBeforeFruit(text: string, factor: number): string {
  const other = text.match(OTHER_PART);
  if (!other) return scaleAmounts(text, factor);
  const [, of, low, separator, high, and] = other;
  const at = other.index ?? 0;
  return `${scaleAmounts(text.slice(0, at), factor)}${of}${scaledRange(low, separator, high, factor, "").text}${and}`;
}

// The fruit part of a line, scaled: "juice of 1 large lemon" x2 -> "juice
// of 2 large lemons"; "juice of ½ a lemon" x4 -> "juice of 2 lemons".
function scaledFruit(fruit: RegExpMatchArray, factor: number): string {
  const [, of, low, separator, high, space, words, name] = fruit;
  const { text: count, last } = scaledRange(low, separator, high, factor, "");
  // "½ a lemon" is "2 a lemons" no more once it's a whole one or more.
  const between = last >= 1 ? words.replace(/^an?\s+/i, "") : words;
  return `${of}${count}${space}${between}${name}${last > 1 ? "s" : ""}`;
}

// A line's amounts, without the fruit part.
function scaleAmounts(line: string, factor: number): string {
  const lead = line.match(LEADING);
  if (lead) {
    const [whole, before, low, separator, high] = lead;
    const rest = line.slice(whole.length);
    const unit = rest.match(UNIT_AFTER);
    if (unit) {
      // Re-read from the start as a measured amount, so alternatives after
      // it are scaled too.
      const measured = scaleMeasured(line, factor, LEADING_MEASURED);
      if (measured) return measured[0] + measured[1];
    }
    // A count ("2 eggs", "1 (400 g) can"): only the count changes.
    return `${before}${scaledRange(low, separator, high, factor, "").text}${rest}`;
  }
  const measured = scaleMeasured(line, factor, MEASURED);
  return measured ? measured[0] + measured[1] : line;
}

// The measured amount scaleLine changes first ("1.5 kg linguine", "Butter,
// 250 g"), read the same way: its unit, and how much (the top of a range,
// so there's enough). null for a count ("2 onions", "1 (400 g) can") or a
// fruit part ("juice of 1 lemon"), which measure nothing, and when the one
// amount isn't all of it: several of it ("Tomatoes, 2 x 400 g cans") or
// more added on ("1 lb 8 oz", "1 cup plus 2 tbsp"). The same amount given
// another way ("250 g/8 oz", "1 cup (250 ml)") still reads.
export function lineMeasure(line: string): { amount: number; unit: string } | null {
  if (FRUIT_PART.test(line)) return null;
  const lead = line.match(LEADING);
  if (lead && !UNIT_AFTER.test(line.slice(lead[0].length))) return null;
  const match = line.match(lead ? LEADING_MEASURED : MEASURED);
  if (!match) return null;
  const before = line.slice(0, match.index);
  const after = line.slice((match.index ?? 0) + match[0].length);
  if (SEVERAL_OF.test(before) || ADDED_ON.test(after)) return null;
  const [, , low, , high, , unit] = match;
  const amount =
    high === undefined
      ? parseNumber(low, unit)
      : isMixedNumber(low, high, unit)
        ? parseNumber(low, unit) + parseNumber(high, unit)
        : parseNumber(high, unit);
  return { amount, unit: unit.trim() };
}

// The amount a line starts with, for adding two lines up (shoppingAddUp.ts):
// how much, its unit ("" for a count: "3 garlic cloves"), and the words
// after it and after the same amount given another way ("250 g/8 oz
// butter": "butter"; "1/2 cup (100 g) tomatoes": ") tomatoes"), which
// scaleLine changes along with it. null with no amount at the start, a
// range ("2-3 onions"), or more added on ("1 cup plus 2 tbsp"), which don't
// add up to one number.
export function leadingAmount(line: string): { amount: number; unit: string; rest: string } | null {
  const start = line.match(LEADING);
  if (!start) return null;
  const [whole, , low, , high] = start;
  const unit = line.slice(whole.length).match(UNIT_AFTER) ? line.match(LEADING_MEASURED) : null;
  const used = unit ?? start;
  const unitText = unit ? unit[6] : "";
  if (high !== undefined && !isMixedNumber(low, high, unitText)) return null;
  let rest = line.slice(used[0].length);
  if (unit) {
    if (ADDED_ON.test(rest)) return null;
    for (let alt = rest.match(ALTERNATIVE); alt; alt = rest.match(ALTERNATIVE)) rest = rest.slice(alt[0].length);
  }
  const amount = high === undefined ? parseNumber(low, unitText) : parseNumber(low, unitText) + parseNumber(high, unitText);
  if (!(amount > 0)) return null;
  return { amount, unit: unitText.trim(), rest };
}

// How many a recipe makes, from its servings text: "4", "Serves 4-6" (4),
// "12 cookies". Null when it doesn't say a number.
export function servingsCount(servings: string): number | null {
  const match = servings.match(new RegExp(String.raw`(?<![\d.])${RANGE}`));
  if (!match) return null;
  const n = parseNumber(match[1]);
  return n > 0 ? n : null;
}

// The servings text with its number (or range) swapped for `count`:
// "Serves 4-6" at 8 -> "Serves 8", "12 cookies" at 24 -> "24 cookies".
export function servingsText(servings: string, count: number): string {
  return servings.replace(new RegExp(String.raw`(?<![\d.])${RANGE}`), kitchenFraction(count));
}

// The servings text as a label and what follows it, so it reads as one
// line: "6 people" -> Serves 6, "Serves 4-6" -> Serves 4-6, "4" -> Serves 4,
// "6 serves" -> Serves 6, "4 hungry people" -> Serves 4 hungry people,
// "12 cookies" -> Makes 12 cookies, "Makes 1 loaf" -> Makes 1 loaf. (Sites
// write it every way, and "Makes 6 people" made people laugh.)
export function servingsWording(servings: string): { label: "Serves" | "Makes"; amount: string } {
  const text = servings.trim();
  const said = text.match(/^(serves|servings|serving(?=\s*:)|feeds|makes|yields?)\b\s*:?\s*/i);
  const rest = said ? text.slice(said[0].length) : text;
  if (said && /^make|^yield/i.test(said[1])) return { label: "Makes", amount: rest };
  // A count of people, maybe with a describing word, maybe a note after.
  const people = rest.match(/^([\d½¼¾⅓⅔⅛][\d\s½¼¾⅓⅔⅛./–-]*?)\s+(\p{L}+\s+)?(people|persons?|adults|guests|pax|serves)(?![\p{L}-])\.?(.*)$/iu);
  if (people) {
    const [, count, describing, word, after] = people;
    // The word goes only when nothing carries on after it but a note ("4
    // adults or 6 children" keeps its "adults").
    if (!/^\s*([(,;.]|$)/.test(after)) return { label: "Serves", amount: rest };
    const amount = describing && !/^serves$/i.test(word) ? `${count} ${describing}${word}` : count;
    return { label: "Serves", amount: `${amount}${after}`.trim() };
  }
  if (said || /^[\d\s½¼¾⅓⅔⅛./–-]+$/.test(rest)) return { label: "Serves", amount: rest };
  return { label: "Makes", amount: rest };
}

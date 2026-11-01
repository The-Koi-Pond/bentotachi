// Scaling a recipe: "Makes 4" turned up to 6 multiplies each ingredient's
// amount by 1.5. Only amounts are changed, never sizes or the method:
//  - The amount a line starts with: "2 cups flour" -> "3 cups flour",
//    "1-2 cloves garlic" -> "1½-3 cloves garlic".
//  - The same amount given another way right after it: "250 g/8 oz butter",
//    "1 cup (250 ml) milk".
//  - Not a size after a count: "1 (400 g) can tomatoes", "2 x 400 g cans".
//  - A line with no amount at the start gets its first measured amount
//    scaled: "Butter, 250 g".
// Cups, spoons and counts come out as kitchen fractions (1½, ⅓), grams and
// millilitres as round numbers. Unit words follow the amount ("1 cup",
// "2 cups"); other words don't ("2 egg" stays possible, as in Paprika).

import { NUMBER, parseNumber } from "./weights.ts";

const RANGE = String.raw`(${NUMBER})(?:(\s*(?:-|–|to)\s*)(${NUMBER}))?`;
const UNITS = String.raw`kgs?|kilos?|kilograms?|grams?|gr|g|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|cups?|tablespoons?|tbsps?\.?|tbs\.?|tbl\.?|teaspoons?|tsps?\.?|fl\.?\s*oz\.?|fluid\s+ounces?|lbs?\.?|pounds?|oz\.?|ounces?|pints?|pt\.?|quarts?|qts?\.?|gallons?|gal\.?`;
const UNIT_AFTER = new RegExp(String.raw`^(\s*-?\s*)(${UNITS})(?![a-z])`, "i");
// Soft marks or bullet-ish characters may come before the amount.
const LEADING = new RegExp(String.raw`^([\s*_•·-]*)${RANGE}`);
// The same amount another way: "/8 oz", " (250 ml", " or 1 cup".
const ALTERNATIVE = new RegExp(String.raw`^(\s*(?:\/|\(|or\s|,)?\s*)${RANGE}(\s*-?\s*)(${UNITS})(?![a-z])`, "i");
// (The empty group stands where LEADING's prefix is, so both read alike.)
const MEASURED = new RegExp(String.raw`(?<![\d.])()${RANGE}(\s*-?\s*)(${UNITS})(?![a-z])`, "i");

const METRIC = /^(?:kgs?|kilos?|kilograms?|grams?|gr|g|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?)$/i;
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
  const n = parseNumber(text) * factor;
  if (unit && METRIC.test(unit.trim())) return metricAmount(n, unit.trim());
  // Written with a decimal point: keep decimals ("1.5 cups" -> "2.25 cups").
  if (/\.\d/.test(text)) return String(Math.round(n * 100) / 100);
  return kitchenFraction(n);
}

// "1-1/2" is one and a half, not 1 to ½ (as weights.ts reads it).
function isMixedNumber(low: string, high: string | undefined): boolean {
  return high !== undefined && parseNumber(high) < parseNumber(low) && parseNumber(high) < 1;
}

function scaledRange(low: string, separator: string | undefined, high: string | undefined, factor: number, unit: string) {
  if (high === undefined || isMixedNumber(low, high)) {
    const amount = high === undefined ? low : String(parseNumber(low) + parseNumber(high));
    return { text: scaledAmount(amount, factor, unit), last: parseNumber(amount) * factor };
  }
  return {
    text: `${scaledAmount(low, factor, unit)}${separator}${scaledAmount(high, factor, unit)}`,
    last: parseNumber(high) * factor,
  };
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
  const lead = line.match(LEADING);
  if (lead) {
    const [whole, before, low, separator, high] = lead;
    const rest = line.slice(whole.length);
    const unit = rest.match(UNIT_AFTER);
    if (unit) {
      // Re-read from the start as a measured amount, so alternatives after
      // it are scaled too.
      const measured = scaleMeasured(line, factor, new RegExp(String.raw`^([\s*_•·-]*)${RANGE}(\s*-?\s*)(${UNITS})(?![a-z])`, "i"));
      if (measured) return measured[0] + measured[1];
    }
    // A count ("2 eggs", "1 (400 g) can"): only the count changes.
    return `${before}${scaledRange(low, separator, high, factor, "").text}${rest}`;
  }
  const measured = scaleMeasured(line, factor, MEASURED);
  return measured ? measured[0] + measured[1] : line;
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

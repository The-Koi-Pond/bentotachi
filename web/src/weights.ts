// Weights in recipes, converted for the household as a soft hint after the
// amount: "1½ lbs *(680 g)* ground beef" in Australia (and anywhere else
// that weighs in grams), "500 g *(1.1 lb)* beef mince" in the US. Only
// weights: cups and spoons are the same everywhere, and "fl oz" is a liquid
// measure, so it's left alone. A line that already gives both ("250 g/8 oz")
// gets no hint.

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };

// "1 1/2", "1/2", "3 ½", "1½", "½", "1.5", "2" (lengths.ts and
// temperatures.ts read numbers the same way).
export const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\s?[½¼¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?)`;
// An amount (groups 1 and 2: "1-2", "1–2", "1 to 2"), then its unit (group 3),
// maybe joined by a hyphen ("14.5-ounce can"). ("1/2" and "1.5" are read
// whole from their start, so only a digit, or a digit and point, is kept
// out in front: "250 g/8oz" and "approx.1 pound" still count.)
const AMOUNT = String.raw`(?<!\d)(?<!\d\.)(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?\s*-?\s*`;
// "fl oz" is matched too, so it can be skipped rather than read as "oz".
const POUNDS_OUNCES = new RegExp(String.raw`${AMOUNT}(fl\.?\s*oz\.?|lbs?\.?|pounds?|oz\.?|ounces?)(?![a-z])`, "gi");
const GRAMS = new RegExp(String.raw`${AMOUNT}(kgs?|kilos?|kilograms?|grams?|gr|g)(?![a-z])`, "gi");

const isFluidOunces = (unit: string) => /^fl/i.test(unit);

export function parseNumber(text: string): number {
  const t = text.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = t.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const unicode = t.match(/^(\d*)\s?([½¼¾⅓⅔⅛⅜⅝⅞])$/);
  if (unicode) return Number(unicode[1] || 0) + FRACTIONS[unicode[2]];
  return Number(t);
}

const round = (n: number, step: number) => Math.round(n / step) * step;
const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

// Grams, as people would weigh them: "14 g", "680 g", "1.4 kg".
function inGrams(grams: number): [string, string] {
  if (grams >= 1000) return [oneDecimal(grams / 1000), "kg"];
  return [String(grams >= 50 ? round(grams, 5) : Math.max(1, Math.round(grams))), "g"];
}

// Pounds and ounces: "0.2 oz", "3.5 oz", "9 oz", "1.1 lb".
function inPounds(grams: number): [string, string] {
  const ounces = grams / 28.3495;
  if (ounces >= 16) return [oneDecimal(ounces / 16), "lb"];
  if (ounces < 1) return [oneDecimal(Math.max(0.1, ounces)), "oz"];
  return [ounces < 10 ? oneDecimal(round(ounces, 0.5)) : String(Math.round(ounces)), "oz"];
}

function gramsPer(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("o")) return 28.3495;
  if (u.startsWith("l") || u.startsWith("p")) return 453.592;
  if (u.startsWith("k")) return 1000;
  return 1;
}

// The converted amount for a match: "680 g", "455–905 g", "900 g–1.4 kg".
function converted(match: RegExpMatchArray, show: (grams: number) => [string, string]): string {
  const grams = gramsPer(match[3]);
  const [low, lowUnit] = show(parseNumber(match[1]) * grams);
  if (!match[2]) return `${low} ${lowUnit}`;
  const [high, highUnit] = show(parseNumber(match[2]) * grams);
  return lowUnit === highUnit ? `${low}–${high} ${highUnit}` : `${low} ${lowUnit}–${high} ${highUnit}`;
}

// The line with a converted weight after each amount in the other system.
export function withWeightHint(line: string, country: string): string {
  const toGrams = country !== "US";
  const weightsIn = (pattern: RegExp) => [...line.matchAll(pattern)].filter((m) => !isFluidOunces(m[3]));
  // Already in the household's units: nothing to add.
  if (weightsIn(toGrams ? GRAMS : POUNDS_OUNCES).length) return line;
  let result = "";
  let at = 0;
  for (const match of weightsIn(toGrams ? POUNDS_OUNCES : GRAMS)) {
    const end = match.index + match[0].trimEnd().length;
    result += `${line.slice(at, end)} *(${converted(match, toGrams ? inGrams : inPounds)})*`;
    at = end;
  }
  return at ? result + line.slice(at) : line;
}

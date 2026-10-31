// Spoons and liquid measures in recipes, as soft hints like weights.ts:
//  - Tablespoons differ: Australia's standard one holds 20 ml, almost
//    everywhere else's 15 ml (and many Australians own 15 ml spoons). A
//    recipe's is guessed from its website (Australian sites use 20 ml); when
//    it isn't the household's spoon, the hint says how much with theirs:
//    "2 tbsp *(your 1 tbsp + 2 tsp)*". Teaspoons are 5 ml everywhere.
//  - Outside the US: cups, fluid ounces, pints, quarts and gallons get
//    millilitres, "1 cup *(240 ml)*" (but not cups in Australia, where
//    kitchens have them: a metric cup is 250 ml, a US one 240 ml).
//  - In the US: millilitres and litres get cups or spoons, "250 ml *(1 cup)*".
// A line that already gives both gets no hint.

import { NUMBER, amountRange } from "./weights.ts";

// What a recipe's measures hold, in ml.
export interface RecipeMeasures {
  tablespoon: number;
  cup: number;
  fluidOunce: number;
  pint: number;
}

const US: RecipeMeasures = { tablespoon: 15, cup: 240, fluidOunce: 29.57, pint: 473 };

// Guessed from where the recipe came from: Australian sites use 20 ml
// tablespoons and 250 ml cups, New Zealand and UK ones 250 ml cups (and UK
// ones imperial pints); anything else (mostly US sites) US measures.
export function recipeMeasures(sourceUrl: string): RecipeMeasures {
  let host = "";
  try {
    host = new URL(sourceUrl).hostname;
  } catch {
    return US;
  }
  if (host.endsWith(".au")) return { tablespoon: 20, cup: 250, fluidOunce: 29.57, pint: 473 };
  if (host.endsWith(".nz")) return { ...US, cup: 250 };
  if (host.endsWith(".uk")) return { tablespoon: 15, cup: 250, fluidOunce: 28.41, pint: 568 };
  return US;
}

// As in weights.ts: an amount (groups 1 and 2 for a range), then the unit
// (group 3).
const AMOUNT = String.raw`(?<!\d)(?<!\d\.)(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?\s*-?\s*`;
const unit = (names: string) => new RegExp(String.raw`${AMOUNT}(${names})(?![a-z])`, "gi");
const TABLESPOONS = unit(String.raw`tablespoons?|tbsps?\.?|tbs\.?|tbl\.?`);
const TEASPOONS = unit(String.raw`teaspoons?|tsps?\.?`);
const CUPS = unit(String.raw`cups?`);
const US_LIQUIDS = unit(String.raw`fl\.?\s*oz\.?|fluid\s+ounces?|pints?|pt\.?|quarts?|qts?\.?|gallons?|gal\.?`);
const METRIC = unit(String.raw`ml|millilit(?:re|er)s?|l|lit(?:re|er)s?`);
const GRAMS = unit(String.raw`kgs?|kilos?|kilograms?|grams?|gr|g`);

const FRACTION_SIGNS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

// 1.5 -> "1½", 0.33 -> "⅓": the nearest quarter or third.
function friendly(n: number, thirds = true): string {
  let whole = Math.floor(n);
  let best: [number, string] = [0, ""];
  for (const option of [[0, ""] as [number, string], ...FRACTION_SIGNS, [1, ""] as [number, string]]) {
    if (!thirds && /[⅓⅔]/.test(option[1])) continue;
    if (Math.abs(n - whole - option[0]) < Math.abs(n - whole - best[0])) best = option;
  }
  if (best[0] === 1) whole += 1;
  return whole ? `${whole}${best[1]}` : best[1] || "0";
}

// Millilitres, as a measuring jug shows them: "15 ml", "240 ml", "1.9 l".
function inMillilitres(ml: number): string {
  if (ml >= 1000) return `${Math.round(ml / 100) / 10} l`;
  return `${ml >= 100 ? Math.round(ml / 10) * 10 : Math.max(5, Math.round(ml / 5) * 5)} ml`;
}

// Spoons for an amount: "1 tbsp + 2 tsp", "3 tsp", "½ tsp" (to the nearest
// quarter teaspoon).
function inSpoons(ml: number, tablespoon: number): string {
  const teaspoons = Math.round((ml / 5) * 4) / 4;
  const perTablespoon = tablespoon / 5;
  const tablespoons = Math.floor(teaspoons / perTablespoon + 1e-9);
  const rest = teaspoons - tablespoons * perTablespoon;
  const parts = [];
  if (tablespoons) parts.push(`${tablespoons} tbsp`);
  if (rest > 0.01 || !tablespoons) parts.push(`${friendly(rest, false)} tsp`);
  return parts.join(" + ");
}

// US cups for an amount, or spoons under a quarter cup: "1 cup", "1½ cups".
function inCups(ml: number, tablespoon: number): string {
  if (ml < 55) return inSpoons(ml, tablespoon);
  const cups = friendly(ml / 240);
  return `${cups} ${cups === "1" ? "cup" : "cups"}`;
}

function liquidMillilitres(name: string, measures: RecipeMeasures): number {
  const u = name.toLowerCase();
  if (u.startsWith("f")) return measures.fluidOunce;
  if (u.startsWith("p")) return measures.pint;
  if (u.startsWith("q")) return measures.pint * 2;
  if (u.startsWith("g")) return measures.pint * 8;
  return measures.cup;
}

const metricMillilitres = (name: string) => (/^l/i.test(name) ? 1000 : 1);

// "1 tbsp + 1 tsp to 2 tbsp + 2 tsp" for a range.
function hintFor(match: RegExpMatchArray, show: (amount: number) => string): string {
  const [low, high] = amountRange(match);
  return high === null ? show(low) : `${show(low)} to ${show(high)}`;
}

// The line with hints after each spoon or liquid amount that needs one.
// ourTablespoon: what the household's tablespoon holds (15 or 20 ml).
export function withVolumeHint(line: string, country: string, measures: RecipeMeasures, ourTablespoon: number): string {
  const hints: { end: number; text: string }[] = [];
  const add = (pattern: RegExp, show: (match: RegExpMatchArray) => string) => {
    for (const match of line.matchAll(pattern))
      hints.push({ end: match.index + match[0].trimEnd().length, text: show(match) });
  };
  const has = (pattern: RegExp) => [...line.matchAll(pattern)].length > 0;

  if (measures.tablespoon !== ourTablespoon)
    add(TABLESPOONS, (m) => `your ${hintFor(m, (n) => inSpoons(n * measures.tablespoon, ourTablespoon))}`);

  if (country === "US") {
    if (!has(CUPS) && !has(TABLESPOONS) && !has(TEASPOONS) && !has(US_LIQUIDS))
      add(METRIC, (m) => hintFor(m, (n) => inCups(n * metricMillilitres(m[3]), ourTablespoon)));
  } else if (!has(METRIC)) {
    // Not for cups of something already weighed: "75 g (½ cup) flour".
    if (country !== "AU" && !has(GRAMS)) add(CUPS, (m) => hintFor(m, (n) => inMillilitres(n * measures.cup)));
    add(US_LIQUIDS, (m) => hintFor(m, (n) => inMillilitres(n * liquidMillilitres(m[3], measures))));
  }

  if (!hints.length) return line;
  hints.sort((a, b) => a.end - b.end);
  let result = "";
  let at = 0;
  for (const hint of hints) {
    result += `${line.slice(at, hint.end)} *(${hint.text})*`;
    at = hint.end;
  }
  return result + line.slice(at);
}

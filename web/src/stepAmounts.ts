// "Amounts in the method" (⋮ menu; Xel, 2026-11-08): a step that names an
// ingredient shows how much, "Add the oregano (1 tsp) and stir", but only
// where it's sure which ingredient is meant:
// - the ingredient line starts with an amount ("1 tsp dried oregano");
// - the step names it by words no other ingredient shares ("oil" with olive
//   oil and sesame oil isn't sure; "olive oil" is);
// - it's the first step that names it (later ones may use the rest);
// - the step doesn't already give an amount, or say "half the", "the
//   remaining", "a little"; and the line isn't "divided" or "plus extra".
// Only for showing: the saved steps stay as written.

import { headingOf } from "./format.ts";
import { withoutSoftMarks } from "./softMarks.ts";

const NUMBER = "(?:\\d+(?:[.,/]\\d+)?(?:\\s+\\d+/\\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞]|\\d+\\s*[½¼¾⅓⅔⅛⅜⅝⅞])";
const UNIT =
  "(?:cups?|c|tablespoons?|tbsps?|tbs|teaspoons?|tsps?|pounds?|lbs?|ounces?|oz|grams?|g|kilograms?|kg|" +
  "millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|quarts?|pints?|pinch(?:es)?|dash(?:es)?|cloves?|cans?|tins?|jars?|" +
  "sticks?|slices?|pieces?|bunch(?:es)?|handfuls?|sprigs?|heads?|stalks?|packets?|bags?|knobs?)";
// "1 tsp", "1/2 cup", "2-3 cloves", "1 1/2 tbsp", "2 × 400 g tins", "500g",
// and both ways at once: "1.2 kg/ 2.4lb", "2 tbsp / 30g".
const AMOUNT = new RegExp(
  `^(${NUMBER}(?:\\s*(?:-|–|to)\\s*${NUMBER})?(?:\\s*${UNIT}\\.?)?(?:\\s*\\/\\s*${NUMBER}\\s*${UNIT}\\.?)?(?:\\s*[×x]\\s*${NUMBER}\\s*${UNIT}\\.?)?(?:\\s+${UNIT}\\.?)?)(?=\\s|$)\\s*(?:of\\s+)?`,
  "i"
);
// What's left starting like an amount ("kg/ 2.4lb chicken" when the amount
// wasn't read whole): not sure, so nothing's shown.
const LEFTOVER_AMOUNT = new RegExp(`^(?:[\\/\\d½¼¾⅓⅔⅛⅜⅝⅞]|${UNIT}\\b)`, "i");

// Words that describe rather than name: alone they'd match too much.
const DESCRIBING = new Set(
  (
    "fresh dried ground large small medium chopped minced sliced diced grated crushed red green white black " +
    "yellow brown extra virgin plain unsalted salted whole raw cooked boneless skinless lean low fat full " +
    "light dark hot cold warm finely roughly thinly baby young ripe frozen canned tinned free range organic " +
    "and or of with for the a to into in on"
  ).split(" ")
);

// Before a mention, these mean only part of the amount is used.
const PART_BEFORE = /\b(half|halves|remaining|rest|some|more|another|reserved|extra|little|bit|leftover|of the)\s+(?:of\s+)?(?:the\s+)?(?:\S+\s+)?$/i;
// An amount right before it ("add 1 tsp oregano", "a pinch of salt").
const AMOUNT_BEFORE = new RegExp(`(?:${NUMBER}|\\ba\\s+(?:pinch|dash|handful|splash|knob))\\s*(?:${UNIT}\\.?\\s*)?(?:of\\s+)?(?:the\\s+)?(?:\\S+\\s+)?$`, "i");

interface Ingredient {
  amount: string;
  // The name's words, lowercase: "dried oregano" -> ["dried", "oregano"].
  words: string[];
  partly: boolean;
}

// "1 tsp dried oregano, crushed" -> { amount: "1 tsp", words: [dried, oregano] }.
export function readIngredient(line: string): Ingredient | null {
  const plain = withoutSoftMarks(line).trim();
  const match = plain.match(AMOUNT);
  if (!match) return null;
  const amount = match[1].trim();
  const rest = plain.slice(match[0].length);
  if (LEFTOVER_AMOUNT.test(rest)) return null;
  const name = rest
    .replace(/\([^)]*\)/g, " ")
    .split(/,\s/)[0]
    .toLowerCase();
  const words = name.match(/[a-zà-ÿ']+(?:-[a-zà-ÿ']+)*/g) ?? [];
  // "3 garlic cloves": the unit after the name goes with the amount.
  const unitLast = words.length > 1 && new RegExp(`^${UNIT}$`, "i").test(words[words.length - 1]);
  const shownAmount = unitLast && /^[\d½¼¾⅓⅔⅛⅜⅝⅞.,/\s-]+$/.test(amount) ? `${amount} ${words.pop()}` : amount;
  if (!words.length) return null;
  return { amount: shownAmount, words, partly: /\bdivided\b|\bplus (?:extra|more)\b|\bto taste\b/i.test(plain) };
}

const stem = (word: string) => (word.length > 3 ? word.replace(/(?:es|s)$/, "") : word);

// Every run of the name's words, longest first, that could name it: not
// one describing word alone ("fresh").
function phrasesOf(words: string[]): string[][] {
  const phrases: string[][] = [];
  for (let length = words.length; length >= 1; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      const phrase = words.slice(start, start + length);
      if (phrase.every((word) => DESCRIBING.has(word))) continue;
      if (DESCRIBING.has(phrase[0]) && length === 1) continue;
      phrases.push(phrase);
    }
  }
  return phrases;
}

const key = (phrase: string[]) => phrase.map(stem).join(" ");

function phrasePattern(phrase: string[]): RegExp {
  const words = phrase.map((word) => stem(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:es|s)?");
  return new RegExp(`(?<![\\p{L}'-])${words.join("\\s+")}(?![\\p{L}'-])`, "iu");
}

export interface StepAmount {
  pattern: RegExp;
  amount: string;
}

// For each step (by index), the amounts to show and the words to show
// them after. Steps and ingredient lines as shown (ingredients scaled).
export function planStepAmounts(steps: string[], ingredientLines: string[]): Map<number, StepAmount[]> {
  const ingredients = ingredientLines.filter((line) => headingOf(line) === null).map(readIngredient);
  // How many ingredients each phrase could mean.
  const meanings = new Map<string, number>();
  const named = ingredientLines
    .filter((line) => headingOf(line) === null)
    .map((line) => withoutSoftMarks(line).replace(/\([^)]*\)/g, " ").split(/,\s/)[0].toLowerCase())
    .map((name) => name.match(/[a-zà-ÿ']+(?:-[a-zà-ÿ']+)*/g) ?? []);
  for (const words of named) {
    for (const phrase of new Set(phrasesOf(words).map(key))) meanings.set(phrase, (meanings.get(phrase) ?? 0) + 1);
  }

  const plan = new Map<number, StepAmount[]>();
  for (const ingredient of ingredients) {
    if (!ingredient || ingredient.partly) continue;
    const sure = phrasesOf(ingredient.words).filter((phrase) => meanings.get(key(phrase)) === 1);
    // The first step that names it, by its longest sure phrase there.
    found: for (let i = 0; i < steps.length; i++) {
      if (headingOf(steps[i]) !== null) continue;
      const text = withoutSoftMarks(steps[i]);
      for (const phrase of sure) {
        const pattern = phrasePattern(phrase);
        const match = text.match(pattern);
        if (!match) continue;
        const before = text.slice(0, match.index);
        if (!PART_BEFORE.test(before) && !AMOUNT_BEFORE.test(before)) {
          plan.set(i, [...(plan.get(i) ?? []), { pattern, amount: ingredient.amount }]);
        }
        break found;
      }
    }
  }
  return plan;
}

// The step with " (1 tsp)" after each planned name (its first mention). A
// name already followed by brackets is left alone. `format` gives an
// amount its regional hints ("1 cup" -> "1 cup (240 ml)"), shown as
// "(1 cup, 240 ml)".
export function withStepAmounts(text: string, amounts: StepAmount[] | undefined, format: (amount: string) => string = (a) => a): string {
  let out = text;
  for (const { pattern, amount } of amounts ?? []) {
    const match = out.match(pattern);
    if (!match || match.index === undefined) continue;
    const end = match.index + match[0].length;
    if (/^\*{0,3}\s*\(/.test(out.slice(end))) continue;
    const shown = format(amount).replace(/\s*\(([^()]*)\)\s*$/, ", $1");
    out = `${out.slice(0, end)} (${shown})${out.slice(end)}`;
  }
  return out;
}

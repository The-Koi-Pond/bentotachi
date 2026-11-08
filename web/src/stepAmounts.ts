// "Amounts in the method" (⋮ menu): a step that names an
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
  "sticks?|slices?|pieces?|bunch(?:es)?|handfuls?|sprigs?|heads?|stalks?|packets?|bags?|knobs?|inch(?:es)?|cm)";
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
  // Each choice's words: "ghee or butter" -> [[ghee], [butter]].
  choices: string[][];
  partly: boolean;
}

// Words that end many names and mean little alone: "the sauce" is any
// sauce, not the fish sauce.
const GENERIC = new Set("sauce juice juices paste seed seeds leaf leaves powder zest flakes flake extract essence".split(" "));
// The part of a thing: "chicken thighs" can be called "chicken", "coriander
// leaves" "coriander".
const PARTS = new Set("leaf leaves seed seeds thigh thighs breast breasts fillet fillets drumsticks wings sprigs stalks".split(" "));

const wordsOf = (text: string): string[] => text.match(/[a-zà-ÿ']+(?:-[a-zà-ÿ']+)*/g) ?? [];

// "1 tsp dried oregano, crushed" -> { amount: "1 tsp", words: [dried, oregano] }.
export function readIngredient(line: string): Ingredient | null {
  const plain = withoutSoftMarks(line).trim();
  const match = plain.match(AMOUNT);
  if (!match) return null;
  let amount = match[1].trim();
  let rest = plain.slice(match[0].length);
  // A size in brackets and what it's in: "1 (400 g) can chopped tomatoes".
  const sized = rest.match(new RegExp(`^\\(([^)]*)\\)\\s*(${UNIT}|each)(?=\\s|$)\\.?\\s*(?:of\\s+)?`, "i"));
  if (sized) {
    amount = `${amount} (${sized[1]}) ${sized[2]}`;
    rest = rest.slice(sized[0].length);
  }
  // "1 tsp each salt and pepper" is two things: not sure which is which.
  if (LEFTOVER_AMOUNT.test(rest) || /^each\b/i.test(rest)) return null;
  const name = rest
    .replace(/\([^)]*\)/g, " ")
    .split(/,\s/)[0]
    .toLowerCase();
  const choices = name.split(/\s+or\s+|\//).map(wordsOf).filter((choice) => choice.length);
  const words = choices.flat();
  // "3 garlic cloves": the unit after the name goes with the amount.
  const unitLast = words.length > 1 && new RegExp(`^${UNIT}$`, "i").test(words[words.length - 1]);
  const withUnit = unitLast && /^[\d½¼¾⅓⅔⅛⅜⅝⅞.,/\s-]+$/.test(amount);
  if (withUnit) {
    amount = `${amount} ${words.pop()}`;
    choices[choices.length - 1].pop();
  }
  // Water is in too many steps ("boiled water", "a pot of water") to be
  // sure it's this water.
  if (!words.length || words.includes("water")) return null;
  return {
    amount,
    words,
    choices: choices.filter((choice) => choice.length),
    partly: /\bdivided\b|\bplus (?:extra|more)\b|\bto taste\b/i.test(plain),
  };
}

// One spelling for a word's singular and plural, as the match pattern
// accepts both: "olive" and "olives" are both "oliv", "tomatoes" "tomato".
const stem = (word: string) => (word.length > 3 ? word.replace(/(?:es|s)$/, "").replace(/e$/, "") : word);

// Every run of the name's words, not one describing word alone ("fresh"):
// what another ingredient's name might share.
function phrasesOf(words: string[]): string[][] {
  const phrases: string[][] = [];
  for (let length = words.length; length >= 1; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      const phrase = words.slice(start, start + length);
      if (phrase.every((word) => DESCRIBING.has(word))) continue;
      phrases.push(phrase);
    }
  }
  return phrases;
}

// What a step may call one choice: its name, or the end of it ("chicken
// stock", "stock"; not "chicken", which more often means other chicken),
// but not a generic word alone ("sauce"); and for a part of something, the
// something ("chicken" for "chicken thighs").
function namesOf(words: string[]): string[][] {
  const ends = (list: string[]) => list.map((_, start) => list.slice(start));
  const names = ends(words);
  if (words.length > 1 && PARTS.has(words[words.length - 1])) names.push(...ends(words.slice(0, -1)));
  return names.filter(
    (phrase) => !phrase.every((word) => DESCRIBING.has(word)) && !(phrase.length === 1 && GENERIC.has(phrase[0]))
  );
}

const key = (phrase: string[]) => phrase.map(stem).join(" ");

function phrasePattern(phrase: string[]): RegExp {
  const words = phrase.map((word) => stem(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:e|es|s)?");
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

  // Each ingredient's main word ("stock" of "chicken stock"): a mention
  // right before another ingredient's main word describes that one ("the
  // chicken stock" isn't the chicken breast).
  const mainWords = ingredients.map((ingredient) =>
    new Set((ingredient?.choices ?? []).map((choice) => stem(choice[choice.length - 1] ?? "")))
  );
  const plan = new Map<number, StepAmount[]>();
  ingredients.forEach((ingredient, index) => {
    if (!ingredient || ingredient.partly) return;
    const othersMain = (word: string) => mainWords.some((words, other) => other !== index && words.has(stem(word)));
    // Longest first, so "cumin seeds" wins over "cumin" in the same step.
    const sure = ingredient.choices
      .flatMap(namesOf)
      .filter((phrase) => meanings.get(key(phrase)) === 1)
      .sort((a, b) => b.length - a.length);
    // The first step that names it, by its longest sure phrase there.
    found: for (let i = 0; i < steps.length; i++) {
      if (headingOf(steps[i]) !== null) continue;
      const text = withoutSoftMarks(steps[i]);
      for (const phrase of sure) {
        const pattern = phrasePattern(phrase);
        const match = text.match(pattern);
        if (!match) continue;
        const before = text.slice(0, match.index);
        const next = text.slice((match.index ?? 0) + match[0].length).match(/^\s+([\p{L}'-]+)/u)?.[1];
        if (!PART_BEFORE.test(before) && !AMOUNT_BEFORE.test(before) && !(next && othersMain(next.toLowerCase()))) {
          plan.set(i, [...(plan.get(i) ?? []), { pattern, amount: ingredient.amount }]);
        }
        break found;
      }
    }
  });
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

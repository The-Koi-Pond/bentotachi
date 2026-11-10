// Ingredients called different things in Australia, the United States and
// the UK ("capsicum" / "bell pepper", "eggplant" / "aubergine"). Bento uses
// these three ways:
//  - pantry links: "Capsicum" in the pantry matches "1 red bell pepper";
//  - search: "capsicum" also finds recipes that say "bell pepper";
//  - a soft hint after another country's word in a recipe, in the
//    household's word: "1 red bell pepper (capsicum)". Only Australian and
//    US households get hints (a British word gets one in both).
// Matching is as in wordMatch.ts (whole words, plurals, accents and hyphens
// don't count, not part of another product), so "shrimp paste" isn't shrimp.

import { findMention, foldText, mentions, stem } from "./wordMatch.ts";

interface NamePair {
  // Every way each country writes it. A word Australia and the UK share
  // goes under au; uk is only for British words that both Australia and
  // the US say differently. A list name is what a hint shows, so write it
  // the way it reads best ("snow peas", "chilli flakes").
  au: string[];
  us: string[];
  uk?: string[];
  // What a hint calls it, if not the first name in the list.
  show?: { au?: string; us?: string };
  // Which households see hints (default both). Chickpeas are chickpeas in
  // the US too, so only Australians get a hint for "garbanzo beans".
  hintFor?: "AU" | "US";
}

// Only where the meaning is the same and certain. Left out on purpose:
// plain "mince" ("minced garlic" is chopped garlic), "tomato sauce" (ketchup
// in Australia, a pasta sauce in the US), "chilli powder" (a spice blend in
// the US), "shallots" (spring onions in much of NSW), "tomato purée" (the
// paste in the UK, a thinner sauce in the US), "pawpaw" (papaya in
// Australia, another fruit in the US), "biscuit", "jelly", "pumpkin",
// "chicory" and "endive", "corn flour" (fine cornmeal in the US), plain
// "bacon" and "pepper".
const PAIRS: NamePair[] = [
  { au: ["capsicum"], us: ["bell pepper", "sweet pepper"] },
  // In the US "coriander" is the seed spice, so only the leaves count.
  { au: ["fresh coriander", "coriander leaves", "coriander leaf"], us: ["cilantro"], show: { au: "coriander" } },
  { au: ["rocket"], us: ["arugula"] },
  { au: ["spring onion"], us: ["green onion", "scallion"] },
  { au: ["prawn"], us: ["shrimp"], show: { au: "prawns" } },
  { au: ["plain flour"], us: ["all-purpose flour"] },
  { au: ["self-raising flour"], us: ["self-rising flour"] },
  { au: ["caster sugar"], us: ["superfine sugar"] },
  { au: ["icing sugar"], us: ["powdered sugar", "confectioners' sugar", "confectioners’ sugar", "confectioners sugar"] },
  { au: ["bicarb soda", "bicarbonate of soda", "bi-carb soda"], us: ["baking soda"] },
  { au: ["cornflour"], us: ["cornstarch"] },
  { au: ["thickened cream"], us: ["heavy cream", "heavy whipping cream"] },
  { au: ["beef mince", "minced beef"], us: ["ground beef"] },
  { au: ["pork mince", "minced pork"], us: ["ground pork"] },
  { au: ["chicken mince", "minced chicken"], us: ["ground chicken"] },
  { au: ["lamb mince", "minced lamb"], us: ["ground lamb"] },
  { au: ["turkey mince", "minced turkey"], us: ["ground turkey"] },
  { au: ["rockmelon"], us: ["cantaloupe"] },
  { au: ["beetroot"], us: ["beet"] },
  { au: ["silverbeet"], us: ["swiss chard"] },
  { au: ["sultana"], us: ["golden raisin"] },
  { au: ["cos lettuce"], us: ["romaine lettuce", "romaine"] },
  { au: ["chickpea"], us: ["garbanzo bean"], hintFor: "AU" },
  { au: ["broad bean"], us: ["fava bean"] },
  { au: ["swede"], us: ["rutabaga"] },
  { au: ["butternut pumpkin"], us: ["butternut squash"] },
  // Not "Chinese cabbage": that can be bok choy too.
  { au: ["wombok", "wong bok"], us: ["napa cabbage"], uk: ["Chinese leaf", "Chinese leaves"] },
  { au: ["witlof", "witloof"], us: ["Belgian endive"] },
  { au: ["celeriac"], us: ["celery root"] },
  // "chestnut mushroom", as plain "chestnut" is the nut.
  { au: ["Swiss brown"], us: ["cremini", "crimini", "baby bella"], uk: ["chestnut mushroom"] },
  { au: ["wholemeal flour"], us: ["whole wheat flour"] },
  { au: ["natural yoghurt", "natural yogurt"], us: ["plain yogurt", "plain yoghurt"] },
  { au: ["full-cream milk", "full-fat milk"], us: ["whole milk"] },
  { au: ["chilli flakes"], us: ["red pepper flakes", "crushed red pepper"] },
  { au: ["stock cube"], us: ["bouillon cube"] },
  { au: ["hundreds and thousands"], us: ["nonpareils"] },
  { au: ["glacé cherries"], us: ["candied cherries"] },
  { au: ["mixed peel"], us: ["candied peel"] },
  { au: ["jelly crystals"], us: ["Jell-O", "jello"] },
  { au: ["eye fillet", "fillet steak"], us: ["beef tenderloin"] },
  { au: ["scotch fillet"], us: ["ribeye", "rib eye"] },
  { au: ["pork fillet"], us: ["pork tenderloin"] },
  { au: ["flaked almonds"], us: ["sliced almonds"] },
  { au: ["baking paper"], us: ["parchment paper", "parchment"] },
  // Australians know all of these; only Americans need "alfoil" explained.
  { au: ["alfoil"], us: ["aluminum foil", "aluminium foil", "tin foil"], hintFor: "US" },
  { au: ["cling wrap"], us: ["plastic wrap"], uk: ["cling film", "clingfilm"] },
  { au: ["paper towel"], us: ["paper towel"], uk: ["kitchen roll", "kitchen paper"] },
  { au: ["dishwashing liquid"], us: ["dish soap"], uk: ["washing-up liquid"] },
  { au: ["bin bag", "bin liner"], us: ["trash bag", "garbage bag"] },
  { au: ["canola oil"], us: ["canola oil"], uk: ["rapeseed oil"] },
  { au: ["eggplant"], us: ["eggplant"], uk: ["aubergine"] },
  { au: ["zucchini"], us: ["zucchini"], uk: ["courgette"] },
  { au: ["snow peas"], us: ["snow peas"], uk: ["mangetout"] },
  { au: ["green beans"], us: ["green beans"], uk: ["French beans"] },
  { au: ["Roma tomato"], us: ["Roma tomato"], uk: ["plum tomato"] },
  // "Strong white bread flour" already says bread flour, so no hint.
  { au: ["bread flour", "baker's flour", "baker’s flour", "bakers flour"], us: ["bread flour"], uk: ["strong flour", "strong white flour"] },
];

// The same word spelled differently: they link and search alike, but get
// no hints (nobody needs "yogurt (yoghurt)").
const SPELLINGS: string[][] = [
  ["yoghurt", "yogurt"],
  ["chilli", "chili", "chile"],
  ["haloumi", "halloumi"],
  ["filo", "phyllo", "fillo"],
  ["gelatine", "gelatin"],
  ["aluminium foil", "aluminum foil"],
  ["liquorice", "licorice"],
  ["doughnut", "donut"],
  ["caster sugar", "castor sugar"],
  ["hummus", "houmous"],
  ["omelette", "omelet"],
  ["kebab", "kabob"],
  ["bok choy", "bok choi", "pak choi", "pak choy"],
  ["kaffir lime", "makrut lime"],
  ["skim milk", "skimmed milk"],
];

// One way only: an Australian "Coriander" in the pantry is the leaves, so it
// matches a US recipe's "cilantro"; a US "Cilantro" doesn't match plain
// "coriander", which may be the ground spice. "English spinach" is plain
// spinach, but Australians sometimes say "spinach" for silverbeet.
const ONE_WAY: [string, string][] = [
  ["coriander", "cilantro"],
  ["english spinach", "spinach"],
];

// Each group of names that are the same thing, with which country (or
// spelling) each name belongs to: a name swaps only for a name in another
// column.
const GROUPS: string[][][] = [
  ...PAIRS.map((pair) => [pair.au, pair.us, pair.uk ?? []]),
  ...SPELLINGS.map((names) => names.map((name) => [name])),
];

// Calls back for each regional term found in the text, with where it is
// and another country's word for it.
function eachSwap(text: string, found: (at: { start: number; end: number }, to: string) => void) {
  for (const columns of GROUPS) {
    columns.forEach((names, column) => {
      for (const from of names) {
        const at = findMention(text, from);
        if (!at) continue;
        columns.forEach((others, other) => {
          if (other !== column) for (const to of others) found(at, to);
        });
      }
    });
  }
  for (const [from, to] of ONE_WAY) {
    const at = findMention(text, from);
    if (at) found(at, to);
  }
}

// Pantry links ask for every pantry item's names on every line.
const otherNamesCache = new Map<string, string[]>();

// Each name with one of its terms swapped for another country's ("Red
// capsicum" -> "Red bell pepper", "Red sweet pepper").
export function otherNames(name: string): string[] {
  const cached = otherNamesCache.get(name);
  if (cached) return cached;
  const names: string[] = [];
  eachSwap(name, (at, to) => names.push(name.slice(0, at.start) + to + name.slice(at.end)));
  const result = [...new Set(names)].filter((other) => other.toLowerCase() !== name.toLowerCase());
  otherNamesCache.set(name, result);
  return result;
}

// A recipe search's words, and the same search with a regional term
// swapped. The swapped term stays one phrase, so "capsicum" looks for "bell
// pepper" together, not any recipe with "bell" and "pepper" in it:
// "capsicum soup" -> [["capsicum", "soup"], ["bell pepper", "soup"], …].
// Words are in lower case, without accents, hyphens as spaces (foldText).
export function searchVariants(text: string): string[][] {
  const words = (part: string) => foldText(part).split(/\s+/).filter(Boolean);
  const variants = [words(text)];
  eachSwap(text, (at, to) => variants.push([...words(text.slice(0, at.start)), foldText(to).trim(), ...words(text.slice(at.end))]));
  const seen = new Set<string>();
  return variants.filter((variant) => {
    const key = variant.join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Words whose plural is the same.
const SAME_PLURAL = new Set(["shrimp", "Jell-O"]);

// "chickpea" -> "chickpeas", for a hint after a plural ("garbanzo beans").
function plural(name: string): string {
  if (name.endsWith("s") || SAME_PLURAL.has(name)) return name;
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(ch|sh|x)$/.test(name)) return `${name}es`;
  return `${name}s`;
}

// The line with a soft hint ("*(capsicum)*") after another country's word
// for something, in the household's word. Only for Australia and the US, and
// not when the line already uses the household's word.
export function withRegionalHint(line: string, country: string): string {
  if (country !== "AU" && country !== "US") return line;
  let text = line;
  for (const pair of PAIRS) {
    if (pair.hintFor && pair.hintFor !== country) continue;
    const mine = country === "AU" ? pair.au : pair.us;
    const ours = new Set(mine.map((name) => name.toLowerCase()));
    const theirs = [...(country === "AU" ? pair.us : pair.au), ...(pair.uk ?? [])].filter((name) => !ours.has(name.toLowerCase()));
    if (mine.some((name) => mentions(text, name))) continue;
    for (const name of theirs) {
      const at = findMention(text, name);
      if (!at) continue;
      const shown = (country === "AU" ? pair.show?.au : pair.show?.us) ?? mine[0];
      // "2 aubergines" gets "(eggplants)"; a name already plural ("hundreds
      // and thousands") stays as it is.
      const isPlural = /s$/i.test(text.slice(at.start, at.end)) && !stem(name).endsWith("s");
      text = `${text.slice(0, at.end)} *(${isPlural ? plural(shown) : shown})*${text.slice(at.end)}`;
      break;
    }
  }
  return text;
}

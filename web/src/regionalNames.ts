// Ingredients called different things in Australia and the United States
// ("capsicum" / "bell pepper"). Bento uses these three ways:
//  - pantry links: "Capsicum" in the pantry matches "1 red bell pepper";
//  - search: "capsicum" also finds recipes that say "bell pepper";
//  - a soft hint after the other country's word in a recipe, in the
//    household's word: "1 red bell pepper (capsicum)".
// Matching is as in wordMatch.ts (whole words, plurals, not part of another
// product), so "shrimp paste" isn't shrimp.

import { findMention, mentions } from "./wordMatch.ts";

interface NamePair {
  // Every way each country writes it.
  au: string[];
  us: string[];
  // What a hint calls it, if not the first name in the list.
  show?: { au?: string; us?: string };
  // Which households see hints (default both). Chickpeas are chickpeas in
  // the US too, so only Australians get a hint for "garbanzo beans".
  hintFor?: "AU" | "US";
}

// Only where the meaning is the same and certain. Left out on purpose:
// plain "mince" ("minced garlic" is chopped garlic), "tomato sauce" (ketchup
// in Australia, a pasta sauce in the US), "chilli powder" (a spice blend in
// the US).
const PAIRS: NamePair[] = [
  { au: ["capsicum"], us: ["bell pepper", "sweet pepper"] },
  // In the US "coriander" is the seed spice, so only the leaves count.
  { au: ["fresh coriander", "coriander leaves", "coriander leaf"], us: ["cilantro"], show: { au: "coriander" } },
  { au: ["rocket"], us: ["arugula"] },
  { au: ["spring onion"], us: ["green onion", "scallion"] },
  { au: ["prawn"], us: ["shrimp"] },
  { au: ["plain flour"], us: ["all-purpose flour", "all purpose flour"] },
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
];

// One way only: an Australian "Coriander" in the pantry is the leaves, so it
// matches a US recipe's "cilantro"; a US "Cilantro" doesn't match plain
// "coriander", which may be the ground spice.
const ONE_WAY: [string, string][] = [["coriander", "cilantro"]];

// Calls back for each regional term found in the text, with where it is
// and the other country's word for it.
function eachSwap(text: string, use: (at: { start: number; end: number }, to: string) => void) {
  const swap = (from: string, to: string) => {
    const at = findMention(text, from);
    if (at) use(at, to);
  };
  for (const pair of PAIRS) {
    for (const from of pair.au) for (const to of pair.us) swap(from, to);
    for (const from of pair.us) for (const to of pair.au) swap(from, to);
  }
  for (const [from, to] of ONE_WAY) swap(from, to);
}

// Each name with one of its terms swapped for the other country's ("Red
// capsicum" -> "Red bell pepper", "Red sweet pepper").
export function otherNames(name: string): string[] {
  const names: string[] = [];
  eachSwap(name, (at, to) => names.push(name.slice(0, at.start) + to + name.slice(at.end)));
  return [...new Set(names)].filter((other) => other.toLowerCase() !== name.toLowerCase());
}

// A recipe search's words, and the same search with a regional term
// swapped. The swapped term stays one phrase, so "capsicum" looks for "bell
// pepper" together, not any recipe with "bell" and "pepper" in it:
// "capsicum soup" -> [["capsicum", "soup"], ["bell pepper", "soup"], …].
export function searchVariants(text: string): string[][] {
  const words = (part: string) => part.toLowerCase().split(/\s+/).filter(Boolean);
  const variants = [words(text)];
  eachSwap(text, (at, to) => variants.push([...words(text.slice(0, at.start)), to.toLowerCase(), ...words(text.slice(at.end))]));
  const seen = new Set<string>();
  return variants.filter((variant) => {
    const key = variant.join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// The line with a soft hint ("*(capsicum)*") after the other country's word
// for something, in the household's word. Only for Australia and the US, and
// not when the line already uses the household's word.
export function withRegionalHint(line: string, country: string): string {
  if (country !== "AU" && country !== "US") return line;
  let text = line;
  for (const pair of PAIRS) {
    if (pair.hintFor && pair.hintFor !== country) continue;
    const mine = country === "AU" ? pair.au : pair.us;
    const theirs = country === "AU" ? pair.us : pair.au;
    if (mine.some((name) => mentions(text, name))) continue;
    for (const name of theirs) {
      const at = findMention(text, name);
      if (!at) continue;
      const shown = (country === "AU" ? pair.show?.au : pair.show?.us) ?? mine[0];
      text = `${text.slice(0, at.end)} *(${shown})*${text.slice(at.end)}`;
      break;
    }
  }
  return text;
}

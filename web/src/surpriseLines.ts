// What the plan's "Surprise me" says above the recipe it picked: gentle at
// first, cheekier the more times in a row it's asked, with rare gems now and
// then (docs/PLAN.md, "Surprise me, gacha style"). The recipe is always
// shown with it: the line never replaces it. Tested in
// web/test/surpriseLines.test.ts.

export const FIRST_LINE = "The dice have spoken.";

export const EVERYDAY = [
  "How about this one?",
  "The dice have spoken.",
  "What about this?",
  "Give this one a go.",
  "A worthy contender.",
  "This one's in the running.",
  "Today's candidate.",
  "Behold, dinner.",
  "A little something from the recipe box.",
  "This one has potential.",
];

export const CHEEKY = [
  "Not feeling the last one, then?",
  "Tough crowd.",
  "Another perfectly good suggestion, rejected.",
  "We're running out of ways to say “how about this?”",
  "The dice are doing their best.",
  "You did ask for a surprise.",
  "Still not convinced?",
  "Picky, picky.",
  "The suspense is unbearable.",
  "At this point, just pick something.",
];

export const RARE = [
  "The dice demand a sacrifice. Preferably garlic bread.",
  "Ben has consulted the ancient texts.",
  "This recipe was chosen by a highly sophisticated system. (Dice.)",
  "The Council of Dinner has reached a decision.",
  "The dice are unionising.",
  "Another spin of the highly scientific dinner wheel.",
  "We have consulted the oracle. It says food.",
];

// Saved for a long run of rolls, so it lands when the app has otherwise
// been quietly minding its own business.
export const BEN_LINE = "Ben is beginning to take this personally.";

const RARE_CHANCE = 1 / 20;
const BEN_FROM_ROLL = 8;
const BEN_CHANCE = 1 / 4;

// How likely a cheeky line is on this roll (the rest are everyday ones).
export function cheekyChance(roll: number): number {
  if (roll <= 3) return 0;
  if (roll <= 6) return 0.5;
  return 0.8;
}

// The line for this roll. `roll` counts the rolls in a row since the
// chooser opened (1 for the first). `choices`: how many recipes it could
// pick from; with one, asking again isn't the person being picky, so it
// stays gentle. `last`: the line shown before, never repeated.
export function surpriseLine(
  roll: number,
  { last = null, choices = 2, random = Math.random }: { last?: string | null; choices?: number; random?: () => number } = {}
): string {
  const turn = choices < 2 ? 1 : roll;
  const pick = (lines: string[]) => {
    const fresh = lines.filter((line) => line !== last);
    const from = fresh.length ? fresh : lines;
    return from[Math.min(from.length - 1, Math.floor(random() * from.length))];
  };
  if (turn <= 1) return last === FIRST_LINE ? pick(EVERYDAY) : FIRST_LINE;
  if (turn >= BEN_FROM_ROLL && last !== BEN_LINE && random() < BEN_CHANCE) return BEN_LINE;
  if (random() < RARE_CHANCE) return pick(RARE);
  return random() < cheekyChance(turn) ? pick(CHEEKY) : pick(EVERYDAY);
}

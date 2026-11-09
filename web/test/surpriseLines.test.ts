// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { BEN_LINE, CHEEKY, EVERYDAY, FIRST_LINE, RARE, cheekyChance, surpriseLine } from "../src/surpriseLines.ts";

// A made-up dice roll: returns these numbers in turn.
const dice = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test("the first roll is always the dice speaking", () => {
  assert.equal(surpriseLine(1, { random: dice(0.99) }), FIRST_LINE);
});

test("the first few rolls stay gentle; later ones get cheekier", () => {
  // Roll 3, not a rare one (0.5): an everyday line, wherever the dice land.
  for (const value of [0, 0.25, 0.5, 0.75, 0.99]) {
    assert.ok(EVERYDAY.includes(surpriseLine(3, { random: dice(0.5, 0, value) })), String(value));
  }
  assert.equal(cheekyChance(3), 0);
  assert.equal(cheekyChance(5), 0.5);
  assert.equal(cheekyChance(9), 0.8);
  // Roll 7: not rare (0.5), cheeky (0.1 < 0.8), the first cheeky line.
  assert.equal(surpriseLine(7, { random: dice(0.5, 0.1, 0) }), CHEEKY[0]);
});

test("rare gems are rare, and Ben only takes it personally after a long run", () => {
  // Roll 2, the dice land under the rare chance: a gem.
  assert.ok(RARE.includes(surpriseLine(2, { random: dice(0.01, 0) })));
  // Roll 7 can't be Ben, however the dice land.
  assert.notEqual(surpriseLine(7, { random: dice(0) }), BEN_LINE);
  assert.equal(surpriseLine(8, { random: dice(0.1) }), BEN_LINE);
  // Not twice in a row.
  assert.notEqual(surpriseLine(9, { last: BEN_LINE, random: dice(0.1, 0.5, 0.5, 0) }), BEN_LINE);
});

test("never the same line twice in a row", () => {
  for (let roll = 1; roll < 12; roll++) {
    for (const value of [0, 0.3, 0.6, 0.99]) {
      const random = dice(0.5, 0.5, value);
      const first = surpriseLine(roll, { random });
      assert.notEqual(surpriseLine(roll, { last: first, random: dice(0.5, 0.5, value) }), first, `roll ${roll}`);
    }
  }
});

test("with only one recipe to offer, asking again isn't picky: it stays gentle", () => {
  assert.equal(surpriseLine(9, { choices: 1, random: dice(0.1) }), FIRST_LINE);
  assert.ok(EVERYDAY.includes(surpriseLine(9, { choices: 1, last: FIRST_LINE, random: dice(0.3) })));
});

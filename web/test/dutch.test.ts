// Dutch (and European) ways of writing amounts: decimal commas, dl and cl,
// el and tl spoons; and "1,000 g" still being a thousand.
// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { parseNumber, withWeightHint } from "../src/weights.ts";
import { recipeMeasures, withVolumeHint } from "../src/volumes.ts";
import { scaleLine } from "../src/scaling.ts";
import { stepTimes } from "../src/stepTimers.ts";

const nl = recipeMeasures("https://www.ah.nl/allerhande/recept/x");

test("a comma before one or two digits is a decimal comma", () => {
  assert.equal(parseNumber("1,5"), 1.5);
  assert.equal(parseNumber("2,25"), 2.25);
});

test("a comma before three digits separates thousands", () => {
  assert.equal(parseNumber("1,000"), 1000);
  assert.equal(parseNumber("1,250.5"), 1250.5);
  assert.equal(withWeightHint("1,000 g flour", "US"), "1,000 g *(2.2 lb)* flour");
});

test("a dot before three digits separates thousands too, as Dutch writes it", () => {
  assert.equal(parseNumber("1.000"), 1000);
  assert.equal(parseNumber("1.500"), 1500);
  assert.equal(parseNumber("1.250,5"), 1250.5);
  assert.equal(scaleLine("1.000 g bloem", 2), "2000 g bloem");
  assert.equal(scaleLine("1.500 ml melk", 2), "3000 ml melk");
  assert.equal(withWeightHint("1.000 g bloem", "US"), "1.000 g *(2.2 lb)* bloem");
});

test("ordinary decimals stay decimals", () => {
  assert.equal(parseNumber("1.5"), 1.5);
  assert.equal(parseNumber("2.25"), 2.25);
  assert.equal(parseNumber("0.125"), 0.125);
  assert.equal(scaleLine("1.5 kg chicken", 2), "3 kg chicken");
  assert.equal(scaleLine("0.125 l cream", 2), "0.25 l cream");
});

test("decimal commas get weight hints", () => {
  assert.equal(withWeightHint("1,5 kg aardappelen", "US"), "1,5 kg *(3.3 lb)* aardappelen");
});

test("el and tl are tablespoons and teaspoons", () => {
  assert.equal(nl.tablespoon, 15);
  // An Australian household with 20 ml spoons.
  assert.equal(withVolumeHint("2 el olijfolie", "AU", nl, 20), "2 el *(your 1 tbsp + 2 tsp)* olijfolie");
  assert.equal(withVolumeHint("2 el olijfolie", "NL", nl, 15), "2 el olijfolie");
});

test("decilitres and centilitres", () => {
  assert.equal(withVolumeHint("2,5 dl melk", "US", nl, 15), "2,5 dl *(1 cup)* melk");
  assert.equal(withVolumeHint("5 cl rum", "US", nl, 15), "5 cl *(3 tbsp + 1 tsp)* rum");
});

test("scaling keeps decimal commas", () => {
  assert.equal(scaleLine("1,5 kg aardappelen", 2), "3 kg aardappelen");
  assert.equal(scaleLine("0,5 l bouillon", 3), "1,5 l bouillon");
  assert.equal(scaleLine("2 el olijfolie", 1.5), "3 el olijfolie");
  assert.equal(scaleLine("2,5 dl melk", 2), "5 dl melk");
  assert.equal(scaleLine("1,000 g flour", 0.5), "500 g flour");
});

test("timers with decimal commas", () => {
  assert.deepEqual(
    stepTimes("Bak 1,5 hours").map((t) => t.seconds),
    [5400]
  );
});

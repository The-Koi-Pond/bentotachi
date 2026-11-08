// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { coverNote, coverOf, stillToBuy, worthBuying } from "../src/pantryStock.ts";
import { lineMeasure } from "../src/scaling.ts";

const sizes = (...list: string[]) => list.map((size) => ({ size }));
const need = (...lines: string[]) => lines.map((line) => ({ line }));
const AU = { tablespoon: 20, cup: 250, fluidOunce: 29.57, pint: 473 };

test("the plan's example: 200 g in, 1.5 kg needed, so 1.3 kg goes on the list", () => {
  const cover = coverOf(need("1.5 kg linguine"), sizes("200 g"));
  assert.equal(cover.kind, "short");
  assert.equal(stillToBuy("1.5 kg linguine", cover), "1.3 kg linguine");
  assert.equal(coverNote(cover), "Have 200 g");
});

test("enough in stock says so, and what's there", () => {
  const cover = coverOf(need("500 g penne"), sizes("500 g", "500 g"));
  assert.deepEqual(cover, { kind: "enough", have: "2 × 500 g" });
  assert.equal(coverNote(cover), "Enough: 2 × 500 g");
  // Nothing is taken off a line that's covered.
  assert.equal(stillToBuy("500 g penne", cover), "500 g penne");
});

test("packets of different sizes are added up", () => {
  assert.deepEqual(coverOf(need("2 kg flour"), sizes("500 g", "750 g")), { kind: "short", have: "1.25 kg", still: 0.375 });
  assert.equal(coverNote(coverOf(need("100 ml cream"), sizes("300 ml", "0.5 L"))), "Enough: 800 ml");
});

test("several lines for the same item are added up", () => {
  const cover = coverOf(need("1 kg rice", "600 g rice"), sizes("1.5 kg"));
  assert.equal(cover.kind, "short");
  assert.ok(Math.abs((cover as { still: number }).still - 0.1 / 1.6) < 1e-9);
});

test("spoons and cups count against bottles, with the recipe's own spoon size", () => {
  assert.equal(coverOf(need("2 tbsp soy sauce"), sizes("250 ml")).kind, "enough");
  // Twelve 20 ml spoons is 240 ml: more than a 200 ml bottle.
  assert.equal(coverOf([{ line: "12 tbsp soy sauce", measures: AU }], sizes("200 ml")).kind, "short");
  assert.equal(coverOf(need("12 tbsp soy sauce"), sizes("200 ml")).kind, "enough");
});

test("pounds and ounces against grams", () => {
  assert.equal(coverOf(need("1 lb beef mince"), sizes("500 g")).kind, "enough");
  assert.equal(coverOf(need("2 lb beef mince"), sizes("500 g")).kind, "short");
});

test("a range counts its top, so there's enough", () => {
  assert.equal(coverOf(need("1-1.5 kg potatoes"), sizes("1 kg")).kind, "short");
});

test("it can't tell, so it says nothing, when", () => {
  // there are no packets,
  assert.deepEqual(coverOf(need("500 g penne"), []), { kind: "unknown" });
  // a packet has no size, or one it can't read,
  assert.deepEqual(coverOf(need("500 g penne"), sizes("1 kg", "")), { kind: "unknown" });
  assert.deepEqual(coverOf(need("500 g penne"), sizes("6 x 375 ml")), { kind: "unknown" });
  // the line is a count, not a measure,
  assert.deepEqual(coverOf(need("2 onions"), sizes("1 kg")), { kind: "unknown" });
  assert.deepEqual(coverOf(need("1 (400 g) can tomatoes"), sizes("400 g")), { kind: "unknown" });
  // or grams are weighed against millilitres.
  assert.deepEqual(coverOf(need("500 g yoghurt"), sizes("1 L")), { kind: "unknown" });
  assert.equal(coverNote({ kind: "unknown" }), "");
});

test("worth buying: the packets decide when they can tell, else Have / Low / Out", () => {
  assert.equal(worthBuying({ status: "low" }, { kind: "enough", have: "1 kg" }), false);
  assert.equal(worthBuying({ status: "have" }, { kind: "short", have: "200 g", still: 0.5 }), true);
  assert.equal(worthBuying({ status: "have" }, { kind: "unknown" }), false);
  assert.equal(worthBuying({ status: "low" }, { kind: "unknown" }), true);
  assert.equal(worthBuying(null, { kind: "unknown" }), true);
});

test("a line's measure is read where scaling reads it", () => {
  assert.deepEqual(lineMeasure("1.5 kg linguine"), { amount: 1.5, unit: "kg" });
  assert.deepEqual(lineMeasure("Butter, 250 g"), { amount: 250, unit: "g" });
  assert.deepEqual(lineMeasure("1-1/2 cups milk"), { amount: 1.5, unit: "cups" });
  assert.equal(lineMeasure("2 onions"), null);
  assert.equal(lineMeasure("1 (400 g) can tomatoes"), null);
  assert.equal(lineMeasure("Juice of 1 lemon"), null);
});

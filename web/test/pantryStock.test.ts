// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { coverNote, coverOf, coversFor, stillToBuy, worthBuying } from "../src/pantryStock.ts";
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
  // Two Australian 250 ml cups are 500 ml, more than 470 ml; two US 240 ml
  // cups are within a few percent of it.
  assert.equal(coverOf([{ line: "2 cups stock", measures: AU }], sizes("470 ml")).kind, "short");
  assert.equal(coverOf(need("2 cups stock"), sizes("470 ml")).kind, "enough");
});

test("pounds and ounces against grams", () => {
  assert.equal(coverOf(need("1 lb beef mince"), sizes("500 g")).kind, "enough");
  assert.equal(coverOf(need("2 lb beef mince"), sizes("500 g")).kind, "short");
  // One and a half pounds is 680 g, more than the 500 g in.
  assert.equal(coverOf(need("1 and 1/2 lb beef mince"), sizes("500 g")).kind, "short");
  assert.deepEqual(lineMeasure("1 and 1/2 cups (188g) flour"), { amount: 1.5, unit: "cups" });
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
  assert.equal(worthBuying({ status: "have" }, { kind: "enough", have: "1 kg" }), false);
  assert.equal(worthBuying({ status: "have" }, { kind: "short", have: "200 g", still: 0.5 }), true);
  assert.equal(worthBuying({ status: "have" }, { kind: "unknown" }), false);
  assert.equal(worthBuying({ status: "low" }, { kind: "unknown" }), true);
  assert.equal(worthBuying(null, { kind: "unknown" }), true);
});

test("marked Low beats packets that look like enough (one may be nearly empty), and the note says so", () => {
  const enough = { kind: "enough", have: "500 g" } as const;
  assert.equal(worthBuying({ status: "low" }, enough), true);
  assert.equal(coverNote(enough, { status: "low" }), "Enough: 500 g, but marked Low");
  assert.equal(coverNote(enough, { status: "have" }), "Enough: 500 g");
});

test("exactly enough is enough", () => {
  assert.equal(coverOf(need("500 g penne"), sizes("500 g")).kind, "enough");
  assert.equal(coverOf([{ line: "1 cup cream", measures: AU }], sizes("250 ml")).kind, "enough");
  assert.equal(coverOf(need("1 L stock"), sizes("1000 ml")).kind, "enough");
});

test("a few percent short counts as enough, so nothing silly goes on the list", () => {
  // A 32 fl oz carton is 946 ml; 4 US cups are 960 ml.
  assert.equal(coverOf(need("4 cups chicken broth"), sizes("32 fl oz")).kind, "enough");
  assert.equal(coverOf(need("1 kg mince"), sizes("999 g")).kind, "enough");
  assert.equal(coverOf(need("400 g chickpeas"), sizes("398 g")).kind, "enough");
  // More than that short is short.
  assert.equal(coverOf(need("1 kg mince"), sizes("900 g")).kind, "short");
});

test("what's still to buy is rounded up, not down", () => {
  // 1 lb is 454 g; with 200 g in, 254 g is short: ½ lb (227 g) would be too
  // little, ⅔ lb (302 g) is the next fraction up.
  assert.equal(stillToBuy("1 lb pasta", coverOf(need("1 lb pasta"), sizes("200 g"))), "⅔ lb pasta");
  // Metric stays exact.
  assert.equal(stillToBuy("1,5 kg flour", coverOf(need("1,5 kg flour"), sizes("200 g"))), "1,3 kg flour");
});

test("ounces weigh, fluid ounces pour", () => {
  assert.equal(coverOf(need("12 oz cheddar"), sizes("250 g")).kind, "short");
  assert.equal(coverOf(need("8 oz cheddar"), sizes("250 g")).kind, "enough");
  assert.equal(coverOf(need("8 fl oz milk"), sizes("250 ml")).kind, "enough");
  assert.equal(coverOf(need("8 fl. oz. milk"), sizes("250 g")).kind, "unknown");
});

test("packets in grams and in millilitres together can't be added up", () => {
  assert.deepEqual(coverOf(need("1.2 kg yoghurt"), sizes("500 g", "1 L")), { kind: "unknown" });
});

test("a line whose one amount isn't all of it can't tell", () => {
  // Several of it,
  assert.deepEqual(coverOf(need("Chopped tomatoes, 2 x 400 g cans"), sizes("400 g")), { kind: "unknown" });
  assert.deepEqual(coverOf(need("Tomatoes (2 × 400 g tins)"), sizes("400 g")), { kind: "unknown" });
  assert.deepEqual(coverOf(need("Chickpeas, 2 (400 g) cans"), sizes("400 g")), { kind: "unknown" });
  assert.deepEqual(coverOf(need("Tomatoes, 2 cans (400 g each)"), sizes("400 g")), { kind: "unknown" });
  // A bracket with no count before it is just the amount.
  assert.equal(coverOf(need("Butter (250 g), softened"), sizes("250 g")).kind, "enough");
  // or more added on.
  assert.deepEqual(coverOf(need("1 lb 8 oz beef mince"), sizes("500 g")), { kind: "unknown" });
  assert.deepEqual(coverOf(need("1 cup plus 2 tablespoons milk"), sizes("250 ml")), { kind: "unknown" });
  assert.deepEqual(coverOf(need("½ cup + 2 tbsp milk"), sizes("100 ml")), { kind: "unknown" });
  // The same amount given another way still reads.
  assert.equal(coverOf(need("250 g/8 oz butter"), sizes("250 g")).kind, "enough");
  assert.equal(coverOf(need("1 cup (250 ml) milk"), sizes("1 L")).kind, "enough");
});

test("one bag isn't counted twice: a line asking for the kind uses it first, then 'any pasta' gets what's left", () => {
  const packets = [{ id: "1", item: "spa", brand: "", size: "500 g", created: "1" }];
  const covers = coversFor(
    [
      { key: "spa", items: [{ id: "spa" }], needs: need("500 g spaghetti"), anyKind: false },
      { key: "kind:pasta", items: [{ id: "spa" }, { id: "pen" }], needs: need("500 g dried pasta"), anyKind: true },
    ],
    packets
  );
  assert.deepEqual(covers.get("spa"), { kind: "enough", have: "500 g" });
  assert.deepEqual(covers.get("kind:pasta"), { kind: "short", have: "none spare", still: 1 });
  // With more in, the group says what's spare.
  const more = coversFor(
    [
      { key: "spa", items: [{ id: "spa" }], needs: need("300 g spaghetti"), anyKind: false },
      { key: "kind:pasta", items: [{ id: "spa" }], needs: need("200 g pasta"), anyKind: true },
    ],
    [{ id: "1", item: "spa", brand: "", size: "1 kg", created: "1" }]
  );
  assert.deepEqual(more.get("kind:pasta"), { kind: "enough", have: "700 g spare" });
  assert.equal(coverNote({ kind: "short", have: "none spare", still: 1 }), "None spare");
});

test("a kind only takes from its own packets: none when it has none, at most what they hold", () => {
  const groups = (spaghettiLine: string) => [
    { key: "spa", items: [{ id: "spa" }], needs: need(spaghettiLine), anyKind: false },
    { key: "kind:pasta", items: [{ id: "spa" }, { id: "pen" }], needs: need("500 g dried pasta"), anyKind: true },
  ];
  const penne = { id: "p", item: "pen", brand: "", size: "500 g", created: "1" };
  const spaghetti = { id: "s", item: "spa", brand: "", size: "500 g", created: "1" };
  // Spaghetti has no packets (marked Have by hand): Penne's bag is all the group's.
  assert.deepEqual(coversFor(groups("500 g spaghetti"), [penne]).get("kind:pasta"), { kind: "enough", have: "500 g" });
  // Spaghetti needs 1 kg but has 500 g: it takes its 500 g, and Penne's stays spare.
  assert.deepEqual(coversFor(groups("1 kg spaghetti"), [penne, spaghetti]).get("kind:pasta"), { kind: "enough", have: "500 g spare" });
  // A spaghetti line that can't be measured takes all of Spaghetti's packets, not the group's answer.
  assert.deepEqual(coversFor(groups("1 packet spaghetti"), [penne, spaghetti]).get("kind:pasta"), { kind: "enough", have: "500 g spare" });
});

test("a partly used packet counts as what's left in it, not its size", () => {
  const open = { size: "500 g", left: "100 g" };
  assert.deepEqual(coverOf(need("400 g linguine"), [open]), { kind: "short", have: "100 g", still: 0.75 });
  // With a full one beside it, the total is said, not "2 × 500 g".
  assert.deepEqual(coverOf(need("400 g linguine"), [open, { size: "500 g", left: "" }]), { kind: "enough", have: "600 g" });
});

test("a line's measure is read where scaling reads it", () => {
  assert.deepEqual(lineMeasure("1.5 kg linguine"), { amount: 1.5, unit: "kg" });
  assert.deepEqual(lineMeasure("Butter, 250 g"), { amount: 250, unit: "g" });
  assert.deepEqual(lineMeasure("1-1/2 cups milk"), { amount: 1.5, unit: "cups" });
  assert.equal(lineMeasure("2 onions"), null);
  assert.equal(lineMeasure("1 (400 g) can tomatoes"), null);
  assert.equal(lineMeasure("Juice of 1 lemon"), null);
});

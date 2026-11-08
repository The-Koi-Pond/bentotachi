// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { gatherIngredients, linesToBuy, listWording, startsTicked } from "../src/weekShopping.ts";

const item = (id: string, name: string, status: string) => ({ id, name, status }) as never;
const pantry = [item("onion", "Onion", "have"), item("eggs", "Eggs", "low"), item("rice", "Rice", "out")];
const recipe = (id: string, title: string, ingredients: string[], links: Record<string, string> | null = null) =>
  ({ id, title, ingredients, ingredient_links: links }) as never;

test("merges lines linked to the same pantry item, across recipes", () => {
  const rows = gatherIngredients(
    [
      recipe("a", "Curry", ["# Base", "2 onions, diced", "1 cup rice", "water"], { water: "" }),
      recipe("b", "Oyakodon", ["1 onion, sliced", "3 eggs", "Dashi"]),
    ],
    pantry
  );
  assert.deepEqual(
    rows.map((r) => [r.text, r.recipeTitles.join(" + "), r.recipeId]),
    [
      // Two recipes, different words: the pantry's name.
      ["Onion", "Curry + Oyakodon", "a"],
      // One recipe: its own words.
      ["1 cup rice", "Curry", "a"],
      ["3 eggs", "Oyakodon", "b"],
      ["Dashi", "Oyakodon", "b"],
    ]
  );
});

test("the list says what the recipe needs, without how to prepare it", () => {
  assert.equal(listWording("12 oz gluten free linguine pasta"), "12 oz gluten free linguine pasta");
  assert.equal(listWording("2 onions, diced"), "2 onions");
  assert.equal(listWording("Feta and coriander, to serve"), "Feta and coriander");
  assert.equal(listWording("2 tsp *soft* dashi, toasted"), "2 tsp soft dashi");
  // A decimal comma isn't a cut.
  assert.equal(listWording("1,5 kg flour"), "1,5 kg flour");
  // Several preparation parts all go; only from the end.
  assert.equal(listWording("1 onion, peeled, finely diced"), "1 onion");
  assert.equal(listWording("Onions, carrots and celery, chopped"), "Onions, carrots and celery");
});

test("nothing to buy is cut off: lists of things, and commas in brackets", () => {
  assert.equal(listWording("Salt, pepper"), "Salt, pepper");
  assert.equal(listWording("2 carrots, 2 celery sticks, 1 onion"), "2 carrots, 2 celery sticks, 1 onion");
  assert.equal(listWording("1 cup chopped walnuts, pecans, or almonds"), "1 cup chopped walnuts, pecans, or almonds");
  assert.equal(listWording("1 cup (2 sticks, 226 g) unsalted butter, softened"), "1 cup (2 sticks, 226 g) unsalted butter");
  assert.equal(listWording("1 can (14.5 oz, drained) tomatoes"), "1 can (14.5 oz, drained) tomatoes");
  // A thing to buy that starts with a preparation word stays.
  for (const line of [
    "Salt, freshly ground black pepper",
    "Coriander, toasted sesame seeds",
    "Basil, grated parmesan",
    "Olive oil, crushed red pepper flakes",
    "Rice noodles, roasted peanuts",
    "Tortillas, salsa, shredded cheese",
  ])
    assert.equal(listWording(line), line);
  // Preparation phrases go: all preparation words, or a leading "to", "cut"…
  assert.equal(listWording("1 carrot, peeled and diced"), "1 carrot");
  assert.equal(listWording("2 potatoes, cut into 2 cm chunks"), "2 potatoes");
  assert.equal(listWording("100 g butter, at room temperature"), "100 g butter");
  assert.equal(listWording("Salt, pepper, to taste"), "Salt, pepper");
  assert.equal(listWording("Sour cream, chopped chives, to serve"), "Sour cream, chopped chives");
  // Asides in brackets, a full stop, and longer preparation still go.
  assert.equal(listWording("1 onion, diced (about 1 cup)"), "1 onion");
  assert.equal(listWording("Parsley, chopped (optional)"), "Parsley");
  assert.equal(listWording("2 onions, diced."), "2 onions");
  assert.equal(listWording("2 potatoes, peeled and cut into chunks"), "2 potatoes");
  assert.equal(listWording("1 lb shrimp, peeled and deveined"), "1 lb shrimp");
  assert.equal(listWording("2 chicken breasts, patted dry"), "2 chicken breasts");
  // But not when there's a thing to buy in it.
  assert.equal(listWording("Salt, small potatoes"), "Salt, small potatoes");
  // The first part is the thing itself, even when it starts like preparation.
  assert.equal(listWording("Chopped parsley, to serve"), "Chopped parsley");
  // A comma inside brackets never cuts, even before a preparation word.
  assert.equal(listWording("1 can chickpeas (15 oz, drained and rinsed)"), "1 can chickpeas (15 oz, drained and rinsed)");
  assert.equal(listWording("2 cups stock [hot, divided]"), "2 cups stock [hot, divided]");
});

test("the plan's sheet uses the list's wording too", () => {
  const rows = gatherIngredients([recipe("a", "Tacos", ["1 lime, juiced", "2 tsp dashi, toasted"])], pantry);
  assert.deepEqual(rows.map((r) => r.text), ["1 lime", "2 tsp dashi"]);
});

test("the same recipe twice in a week is named once, by the pantry's name", () => {
  const curry = recipe("a", "Curry", ["2 onions"]);
  const rows = gatherIngredients([curry, curry], pantry);
  assert.deepEqual(rows[0].recipeTitles, ["Curry"]);
  // Twice "2 onions" is 4: not one line's amount.
  assert.equal(rows[0].text, "Onion");
});

test("a recipe's lines sharing a pantry item go on the list once, by its name", () => {
  const butter = item("butter", "Butter", "low");
  const things = linesToBuy([
    { text: "2 tbsp butter, softened", pantryItem: butter },
    { text: "1 lime, juiced", pantryItem: null },
    { text: "1 tbsp butter", pantryItem: butter },
    { text: "3 eggs", pantryItem: item("eggs", "Eggs", "low") },
  ]);
  assert.deepEqual(
    things.map((t) => [t.text, (t.pantryItem as { id: string } | null)?.id ?? null]),
    [
      ["Butter", "butter"],
      ["1 lime", null],
      // Still linked, so buying it marks the pantry item Have.
      ["3 eggs", "eggs"],
    ]
  );
});

test("unlinked lines merge only when the wording matches", () => {
  const rows = gatherIngredients([recipe("a", "A", ["Dashi"]), recipe("b", "B", ["dashi ", "2 tsp dashi"])], pantry);
  assert.deepEqual(rows.map((r) => r.text), ["Dashi", "2 tsp dashi"]);
});

test("unlinked lines lose their formatting marks, as from the recipe page", () => {
  const rows = gatherIngredients([recipe("a", "A", ["2 tsp *soft* dashi"]), recipe("b", "B", ["2 tsp soft **dashi**"])], pantry);
  assert.deepEqual(rows.map((r) => [r.text, r.recipeTitles.join(" + ")]), [["2 tsp soft dashi", "A + B"]]);
});

test("starts with everything ticked except what we have", () => {
  const rows = gatherIngredients([recipe("a", "A", ["onion", "eggs", "rice", "dashi"])], pantry);
  assert.deepEqual(rows.map((r) => [r.text, startsTicked(r)]), [
    ["onion", false],
    ["eggs", true],
    ["rice", true],
    ["dashi", true],
  ]);
});

const packet = (id: string, itemId: string, size: string) => ({ id, item: itemId, brand: "", size, created: id });
const stocked = [
  item("pasta", "Linguine", "have"),
  item("rice", "Rice", "have"),
  item("flour", "Flour", "have"),
  item("soy", "Soy sauce", "have"),
  item("oats", "Oats", "low"),
];
const packets = [packet("1", "pasta", "200 g"), packet("2", "rice", "1 kg"), packet("3", "rice", "1 kg")];

test("packets in stock: a short line asks for the rest, a covered one starts unticked", () => {
  const rows = gatherIngredients(
    [recipe("a", "Pasta", ["1.5 kg linguine, cooked", "500 g rice", "2 cups flour"], { "1.5 kg linguine, cooked": "pasta" })],
    stocked,
    packets
  );
  assert.deepEqual(
    rows.map((r) => [r.text, r.cover.kind, startsTicked(r)]),
    [
      // Have, but only 200 g of 1.5 kg: ticked, for the 1.3 kg still needed.
      ["1.3 kg linguine", "short", true],
      // 2 kg in: enough, so unticked.
      ["500 g rice", "enough", false],
      // No packets: Have / Low / Out decides, as before.
      ["2 cups flour", "unknown", false],
    ]
  );
});

test("packets in stock: the amount after the comma counts, as on the recipe page", () => {
  const parmesan = [item("par", "Parmesan", "have")];
  const [row] = gatherIngredients([recipe("a", "Pasta", ["Parmesan, finely grated (about 50 g)"])], parmesan, [packet("9", "par", "200 g")]);
  assert.deepEqual([row.text, row.cover.kind, startsTicked(row)], ["Parmesan", "enough", false]);
});

test("packets in stock: a merged row keeps the pantry's name and adds up what both recipes need", () => {
  const rows = gatherIngredients(
    [recipe("a", "Curry", ["1.5 kg rice"]), recipe("b", "Fried rice", ["800 g rice"])],
    stocked,
    packets
  );
  assert.deepEqual(rows.map((r) => [r.text, r.cover.kind, startsTicked(r)]), [["Rice", "short", true]]);
});

test("any kind will do: the group is one row, counting every kind's packets, and goes on the list unlinked", () => {
  const kinds = [
    { id: "lin", name: "Linguine", status: "out", kind_of: "Pasta" },
    { id: "pen", name: "Penne", status: "have", kind_of: "Pasta" },
  ] as never[];
  const pasta = [packet("p1", "pen", "500 g"), packet("p2", "lin", "200 g")];
  const rows = gatherIngredients(
    [recipe("a", "Bake", ["500 g pasta"]), recipe("b", "Salad", ["200 g short pasta"])],
    kinds,
    pasta
  );
  assert.deepEqual(
    rows.map((r) => [r.text, r.pantryItem, r.family?.name, r.cover.kind, startsTicked(r)]),
    // 700 g needed, 700 g in (Penne's and Linguine's packets together).
    [["Pasta", null, "Pasta", "enough", false]]
  );
  // With no packets, the group's level decides: Penne is in, so not ticked.
  const noPackets = gatherIngredients([recipe("a", "Bake", ["500 g pasta"])], kinds, []);
  assert.deepEqual(noPackets.map((r) => [r.cover.kind, startsTicked(r)]), [["unknown", false]]);
  // One bag isn't counted for both a spaghetti recipe and an "any pasta" one.
  const spaghetti = [{ id: "spa", name: "Spaghetti", status: "have", kind_of: "Pasta" }] as never[];
  const week = gatherIngredients(
    [recipe("a", "Bolognese", ["500 g spaghetti"]), recipe("b", "Bake", ["500 g dried pasta"])],
    spaghetti,
    [packet("s1", "spa", "500 g")]
  );
  assert.deepEqual(week.map((r) => [r.text, r.cover.kind, startsTicked(r)]), [
    ["500 g spaghetti", "enough", false],
    ["500 g dried pasta", "short", true],
  ]);
  // A kind named on its own is only that kind: Linguine is out.
  const only = gatherIngredients([recipe("c", "Vongole", ["400 g linguine"])], kinds, []);
  assert.deepEqual(only.map((r) => [r.pantryItem?.id, startsTicked(r)]), [["lin", true]]);
});

test("packets in stock: each recipe's spoons are its own site's, and marked Low still starts ticked", () => {
  const more = [...packets, packet("4", "soy", "200 ml"), packet("5", "oats", "1 kg")];
  const au = { ...(recipe("a", "Stir-fry", ["12 tbsp soy sauce", "200 g oats"]) as object), source_url: "https://www.taste.com.au/x" };
  const us = { ...(recipe("b", "Glaze", ["12 tbsp soy sauce"]) as object), source_url: "https://www.allrecipes.com/x" };
  // Twelve Australian 20 ml spoons are 240 ml: more than the 200 ml bottle.
  assert.deepEqual(
    gatherIngredients([au as never], stocked, more).map((r) => [r.text, r.cover.kind, startsTicked(r)]),
    [
      ["2 tbsp soy sauce", "short", true],
      // 1 kg covers 200 g, but someone marked it Low.
      ["200 g oats", "enough", true],
    ]
  );
  // Twelve US 15 ml spoons are 180 ml: the bottle covers it.
  assert.deepEqual(gatherIngredients([us as never], stocked, more).map((r) => r.cover.kind), ["enough"]);
});

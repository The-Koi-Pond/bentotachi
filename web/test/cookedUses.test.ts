// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { cookedUses } from "../src/cookedUses.ts";

const item = (id: string, name: string, status = "have", extra = {}) => ({ id, name, status, ...extra }) as never;
let n = 0;
// Each packet a minute newer than the last, so oldest first is well defined.
const packet = (itemId: string, size: string, left = "") => {
  n += 1;
  const minute = String(n % 60).padStart(2, "0");
  const hour = String(Math.floor(n / 60)).padStart(2, "0");
  return { id: `p${n}`, item: itemId, brand: "", size, left, created: `2026-11-01 ${hour}:${minute}:00.000Z` } as never;
};
const ids = (list: { id: string }[]) => list.map((p) => p.id);

test("part of a packet used leaves 'about … left' on it", () => {
  const pasta = item("lin", "Linguine");
  const bag = packet("lin", "500 g");
  const [use] = cookedUses(["400 g linguine"], null, [pasta], [bag]);
  assert.equal(use.title, "Linguine: 400 g of the 500 g one");
  assert.equal(use.note, "About 100 g left");
  assert.equal(use.ticked, true);
  assert.deepEqual(use.leave, { packet: bag, left: "100 g" });
  assert.deepEqual(use.finish, []);
  assert.equal(use.status, null);
});

test("a recipe cooked bigger uses more; its chosen links still count; headings are skipped", () => {
  const pasta = item("lin", "Linguine");
  const bags = [packet("lin", "500 g"), packet("lin", "500 g")];
  const links = { "400 g pasta": "lin" };
  // "400 g pasta", chosen as Linguine, cooked at double: 800 g.
  const [use] = cookedUses(["# Pasta", "400 g pasta"], links, [pasta], bags, { scale: 2 });
  assert.equal(use.title, "Linguine: 1 and some of another");
  assert.equal(use.leave?.left, "200 g");
  // Some is still left, so it isn't Out.
  assert.equal(use.status, null);
  assert.equal(use.note, "About 200 g left in the open one");
});

test("a count of tins or cans uses up that many packets, oldest first", () => {
  const chickpeas = item("chk", "Chickpeas");
  const tins = [packet("chk", "400 g"), packet("chk", "400 g"), packet("chk", "400 g")];
  const [use] = cookedUses(["1 (400 g) can chickpeas, drained"], null, [chickpeas], tins);
  assert.equal(use.title, "Chickpeas: 1 of 3");
  assert.deepEqual(ids(use.finish), [(tins[0] as { id: string }).id]);
  assert.equal(use.status, null);
});

test("using the last of it says so, and marks it Out", () => {
  const rice = item("rice", "Rice");
  // Two lines for the same thing are added up: 1.1 kg from a 1 kg bag.
  const [use] = cookedUses(["500 g rice", "600 g rice, cooked"], null, [rice], [packet("rice", "1 kg")]);
  assert.equal(use.note, "That's the last of it: marks it Out");
  assert.equal(use.status, "out");
  assert.equal(use.finish.length, 1);
});

test("a partly used packet is used first, and whole ones after it", () => {
  const flour = item("fl", "Flour");
  const open = packet("fl", "1 kg", "200 g");
  const full = [packet("fl", "1 kg"), packet("fl", "1 kg")];
  const [use] = cookedUses(["500 g flour"], null, [flour], [...full, open]);
  assert.deepEqual(ids(use.finish), [(open as { id: string }).id]);
  assert.equal(use.leave?.left, "700 g");
  assert.equal(use.title, "Flour: 1 and some of another");
  assert.equal(use.note, "About 700 g left in the open one");
});

test("an open packet is finished before an older full one", () => {
  const butter = item("bu", "Butter");
  const full = packet("bu", "500 g");
  const open = packet("bu", "500 g", "200 g");
  const [use] = cookedUses(["200 g butter"], null, [butter], [full, open]);
  assert.deepEqual(ids(use.finish), [(open as { id: string }).id]);
  assert.equal(use.leave, null);
  assert.equal(use.title, "Butter: 1 of 2");
  assert.equal(use.status, null);
});

test("a crumb left counts as used up", () => {
  const sugar = item("su", "Sugar");
  const [use] = cookedUses(["490 g sugar"], null, [sugar], [packet("su", "500 g"), packet("su", "500 g")]);
  assert.equal(use.finish.length, 1);
  assert.equal(use.leave, null);
});

test("an item with no packets rides along as 'mark it Low?', unticked, when something with packets was used", () => {
  const pasta = item("lin", "Linguine");
  const bag = packet("lin", "500 g");
  const uses = cookedUses(["400 g linguine", "50 g parmesan"], null, [pasta, item("par", "Parmesan")], [bag]);
  const parmesan = uses.find((use) => use.item.name === "Parmesan")!;
  assert.deepEqual([parmesan.title, parmesan.note, parmesan.ticked, parmesan.status], ["Parmesan", "None counted in stock: mark it Low?", false, "low"]);
  // Already Low or Out: nothing to offer for it.
  for (const status of ["low", "out"]) {
    const others = cookedUses(["400 g linguine", "50 g parmesan"], null, [pasta, item("par", "Parmesan", status)], [bag]);
    assert.deepEqual(others.map((use) => use.item.name), ["Linguine"], status);
  }
});

test("a household that doesn't count packets is never asked", () => {
  assert.deepEqual(cookedUses(["50 g parmesan", "2 onions", "1 tbsp oil"], null, [item("par", "Parmesan"), item("on", "Onion"), item("oil", "Oil")], []), []);
});

test("a part of a packet already part-used leaves the right amount", () => {
  const flour = item("fl", "Flour");
  const [use] = cookedUses(["50 g flour"], null, [flour], [packet("fl", "1 kg", "200 g")]);
  assert.equal(use.leave?.left, "150 g");
  assert.equal(use.title, "Flour: 50 g of the 1 kg one");
});

test("a heading naming an item is skipped, not read as an unmeasured line", () => {
  const rice = item("rice", "Rice");
  const [use] = cookedUses(["# Rice", "200 g rice"], null, [rice], [packet("rice", "1 kg")]);
  assert.equal(use.leave?.left, "800 g");
});

test("a count and a measure for the same thing can't tell, without breaking", () => {
  const chickpeas = item("chk", "Chickpeas");
  assert.deepEqual(cookedUses(["1 tin chickpeas", "100 g chickpeas"], null, [chickpeas], [packet("chk", "400 g")]), []);
});

test("spoons are the recipe's own size", () => {
  const oil = item("oil", "Olive oil");
  const AU = { tablespoon: 20, cup: 250, fluidOunce: 29.57, pint: 473 };
  assert.equal(cookedUses(["4 tbsp olive oil"], null, [oil], [packet("oil", "250 ml")], { measures: AU })[0].leave?.left, "170 ml");
  assert.equal(cookedUses(["4 tbsp olive oil"], null, [oil], [packet("oil", "250 ml")])[0].leave?.left, "190 ml");
});

test("only under 5% left counts as used up", () => {
  const sugar = item("su", "Sugar");
  // 30 g of 500 g is 6% left: kept.
  assert.equal(cookedUses(["470 g sugar"], null, [sugar], [packet("su", "500 g")])[0].leave?.left, "30 g");
});

test("nothing is offered when it can't tell: counts of things, unreadable packets, any kind of a group", () => {
  const onion = item("on", "Onion");
  assert.deepEqual(cookedUses(["2 onions"], null, [onion], [packet("on", "1 kg")]), []);
  const oil = item("oil", "Olive oil");
  assert.deepEqual(cookedUses(["2 tbsp olive oil"], null, [oil], [packet("oil", "")]), []);
  // Grams against a bottle in millilitres.
  assert.deepEqual(cookedUses(["100 g olive oil"], null, [oil], [packet("oil", "750 ml")]), []);
  const kinds = [item("lin", "Linguine", "have", { kind_of: "Pasta" }), item("pen", "Penne", "have", { kind_of: "Pasta" })];
  assert.deepEqual(cookedUses(["500 g pasta"], null, kinds, [packet("pen", "500 g")]), []);
  // Lines not in the pantry at all.
  assert.deepEqual(cookedUses(["a pinch of salt"], null, [], []), []);
});

test("counts: 3 eggs from a carton of 12 leaves 9, and loose onions come off one each", () => {
  const eggs = item("egg", "Eggs");
  const carton = packet("egg", "12 eggs");
  const [use] = cookedUses(["3 eggs"], null, [eggs], [carton]);
  assert.deepEqual(use.leave, { packet: carton, left: "9" });
  assert.deepEqual([use.title, use.note], ["Eggs: 3 of the 12", "About 9 left"]);
  // The next time, from what's left.
  const opened = { ...(carton as object), left: "9" } as never;
  const [again] = cookedUses(["4 eggs"], null, [eggs], [opened]);
  assert.deepEqual(again.leave, { packet: opened, left: "5" });
  assert.equal(again.title, "Eggs: 4 of the 9 left");
  const onion = item("on", "Onion");
  const loose = [packet("on", "1"), packet("on", "1"), packet("on", "1"), packet("on", "1")];
  const [onions] = cookedUses(["1 onion, diced"], null, [onion], loose);
  assert.deepEqual([onions.title, ids(onions.finish)], ["Onion: 1 of 4", ids(loose.slice(0, 1))]);
  // A number of something else, though the item is named: not 2 celery.
  assert.deepEqual(cookedUses(["2 celery stalks, diced"], null, [item("cel", "Celery")], [packet("cel", "1")]), []);
  // "1 egg yolk", or a carton with no size: nothing guessed.
  assert.deepEqual(cookedUses(["1 egg yolk"], null, [eggs], [packet("egg", "12")]), []);
  assert.deepEqual(cookedUses(["3 eggs"], null, [eggs], [packet("egg", "")]), []);
});

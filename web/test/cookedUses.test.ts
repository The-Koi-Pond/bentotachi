// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { cookedUses } from "../src/cookedUses.ts";

const item = (id: string, name: string, status = "have", extra = {}) => ({ id, name, status, ...extra }) as never;
let n = 0;
const packet = (itemId: string, size: string, left = "") =>
  ({ id: `p${++n}`, item: itemId, brand: "", size, left, created: `2026-11-0${n} 00:00:00.000Z` }) as never;
const ids = (list: { id: string }[]) => list.map((p) => p.id);

test("part of a packet used leaves 'about … left' on it", () => {
  const pasta = item("lin", "Linguine");
  const bag = packet("lin", "500 g");
  const [use] = cookedUses(["400 g linguine"], null, [pasta], [bag]);
  assert.equal(use.title, "Linguine: 400 g of the 500 g packet");
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
  assert.equal(use.title, "Linguine: 1 packet and some of another");
  assert.equal(use.leave?.left, "200 g");
});

test("a count of tins or cans uses up that many packets, oldest first", () => {
  const chickpeas = item("chk", "Chickpeas");
  const tins = [packet("chk", "400 g"), packet("chk", "400 g"), packet("chk", "400 g")];
  const [use] = cookedUses(["1 (400 g) can chickpeas, drained"], null, [chickpeas], tins);
  assert.equal(use.title, "Chickpeas: 1 of 3 packets");
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
  assert.equal(use.title, "Flour: 1 packet and some of another");
  assert.equal(use.note, "About 700 g left in the open one");
});

test("a crumb left counts as used up", () => {
  const sugar = item("su", "Sugar");
  const [use] = cookedUses(["490 g sugar"], null, [sugar], [packet("su", "500 g"), packet("su", "500 g")]);
  assert.equal(use.finish.length, 1);
  assert.equal(use.leave, null);
});

test("an item with no packets is only offered as Low, unticked", () => {
  const parmesan = item("par", "Parmesan");
  const [use] = cookedUses(["50 g parmesan"], null, [parmesan], []);
  assert.deepEqual([use.title, use.note, use.ticked, use.status], ["Parmesan", "No packets counted: mark it Low?", false, "low"]);
  // Already Low or Out: nothing to offer.
  assert.deepEqual(cookedUses(["50 g parmesan"], null, [item("par", "Parmesan", "low")], []), []);
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

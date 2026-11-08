// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { newToTheList, onTheList, sameThing } from "../src/shoppingMatch.ts";

test("a pantry item is on the list by its link, or by name on an unlinked row", () => {
  const milk = { id: "milk", name: "Milk" };
  assert.equal(onTheList(milk, [{ text: "2 L full cream", pantry_item: "milk" }]), true);
  assert.equal(onTheList(milk, [{ text: " milk ", pantry_item: "" }]), true);
  // A "Milk" row linked to another item (oat milk, say) isn't this one.
  assert.equal(onTheList(milk, [{ text: "Milk", pantry_item: "oat" }]), false);
  assert.equal(onTheList(milk, []), false);
});

test("adding to the list skips what's waiting there and repeats in one go, keeping the order", () => {
  const waiting = [{ text: "Milk", pantry_item: "milk" }, { text: "2 onions", pantry_item: "" }];
  const things = [
    { text: "2 L milk", pantryItem: "milk", recipe: "r" },
    { text: "500 g rice", pantryItem: "rice", recipe: "r" },
    { text: "2 Onions ", pantryItem: "", recipe: "r" },
    { text: "Feta", pantryItem: "", recipe: "r" },
    { text: "Rice", pantryItem: "rice", recipe: "s" },
  ];
  assert.deepEqual(newToTheList(things, waiting).map((t) => t.text), ["500 g rice", "Feta"]);
  // The waiting list itself isn't changed.
  assert.equal(waiting.length, 2);
  // Nothing waiting: everything, once each.
  assert.deepEqual(newToTheList([{ text: "Feta", pantryItem: "" }, { text: "feta", pantryItem: "" }], []).map((t) => t.text), ["Feta"]);
});

test("the same pantry item is already on the list, whatever it's called there", () => {
  assert.equal(sameThing({ text: "Milk", pantryItem: "a" }, { text: "2 L milk", pantry_item: "a" }), true);
});

test("the same name is already on the list, ignoring capitals and spaces", () => {
  assert.equal(sameThing({ text: " milk ", pantryItem: "" }, { text: "Milk", pantry_item: "" }), true);
  assert.equal(sameThing({ text: "Milk", pantryItem: "a" }, { text: "milk", pantry_item: "" }), true);
  assert.equal(sameThing({ text: "Milk", pantryItem: "" }, { text: "milk", pantry_item: "a" }), true);
});

test("the same name linked to a different pantry item is something else", () => {
  assert.equal(sameThing({ text: "Milk", pantryItem: "a" }, { text: "Milk", pantry_item: "b" }), false);
});

test("a different name isn't on the list", () => {
  assert.equal(sameThing({ text: "Milk", pantryItem: "" }, { text: "Oat milk", pantry_item: "" }), false);
});

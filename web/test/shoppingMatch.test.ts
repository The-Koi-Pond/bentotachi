// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { sameThing } from "../src/shoppingMatch.ts";

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

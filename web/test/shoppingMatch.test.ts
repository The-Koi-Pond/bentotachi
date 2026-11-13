// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { onTheList, onTheListAs, sameThing } from "../src/shoppingMatch.ts";

test("a pantry item on the list under another wording is found, so it isn't added twice", () => {
  const milk = { id: "milk", name: "Milk" };
  const recipeLine = { text: "300ml milk", pantry_item: "" };
  assert.equal(onTheListAs(milk, [recipeLine]), recipeLine);
  assert.equal(onTheListAs(milk, [{ text: "2 cups milk, warmed", pantry_item: "" }])?.text, "2 cups milk, warmed");
  // Not another product with its name in it, nor a row of another item's.
  for (const text of ["400ml coconut milk", "Milk chocolate", "Milk Arrowroot biscuits", "milk bread", "evaporated milk"])
    assert.equal(onTheListAs(milk, [{ text, pantry_item: "" }]), null, text);
  for (const [name, text] of [
    ["Butter", "butter beans"],
    ["Garlic", "garlic bread"],
    ["Rice", "rice bran oil"],
    ["Lemons", "lemon juice"],
    ["Eggs", "Easter eggs"],
  ])
    assert.equal(onTheListAs({ id: "x", name }, [{ text, pantry_item: "" }]), null, text);
  assert.equal(onTheListAs({ id: "e", name: "Eggs" }, [{ text: "6 large eggs", pantry_item: "" }])?.text, "6 large eggs");
  // Containers and counts are amounts too.
  for (const [name, text] of [
    ["Eggs", "a dozen large eggs"],
    ["Ice cream", "1 tub ice cream"],
    ["Strawberries", "2 punnets strawberries"],
    ["Coriander", "1 bunch coriander"],
    ["Spring onions", "2 bunches spring onions"],
    ["Cream", "1 carton cream"],
    ["Yeast", "2 sachets yeast"],
  ])
    assert.equal(onTheListAs({ id: "x", name }, [{ text, pantry_item: "" }])?.text, text, text);
  // Plain describing words, and an amount after it, leave it the thing.
  for (const text of ["1 cup whole milk", "250 ml skim milk", "2 L full cream milk", "Milk 2L", "Light milk", "1 cup warm milk", "1 and 1/2 cups milk", "1 & ½ cups milk"])
    assert.equal(onTheListAs(milk, [{ text, pantry_item: "" }])?.text, text, text);
  assert.equal(onTheListAs({ id: "c", name: "Cream" }, [{ text: "300 ml thickened cream", pantry_item: "" }])?.text, "300 ml thickened cream");
  assert.equal(onTheListAs({ id: "r", name: "Rice" }, [{ text: "1 cup basmati rice", pantry_item: "" }])?.text, "1 cup basmati rice");
  assert.equal(onTheListAs({ id: "k", name: "Cheese" }, [{ text: "250 g cream cheese", pantry_item: "" }]), null, "cream cheese is its own thing");
  assert.equal(onTheListAs(milk, [{ text: "300ml milk", pantry_item: "oat" }]), null);
  // On the list as itself: that's onTheList's.
  assert.equal(onTheListAs(milk, [{ text: "Milk", pantry_item: "" }, recipeLine]), null);
  // Another country's name for it.
  assert.equal(onTheListAs({ id: "c", name: "Red capsicum" }, [{ text: "1 red bell pepper", pantry_item: "" }])?.text, "1 red bell pepper");
});

test("a pantry item is on the list by its link, or by name on an unlinked row", () => {
  const milk = { id: "milk", name: "Milk" };
  assert.equal(onTheList(milk, [{ text: "2 L full cream", pantry_item: "milk" }]), true);
  assert.equal(onTheList(milk, [{ text: " milk ", pantry_item: "" }]), true);
  // A "Milk" row linked to another item (oat milk, say) isn't this one.
  assert.equal(onTheList(milk, [{ text: "Milk", pantry_item: "oat" }]), false);
  assert.equal(onTheList(milk, []), false);
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

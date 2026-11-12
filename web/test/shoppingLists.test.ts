// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { listOf, mainListId, orderedLists, rowsOn, storedList, toBuyOn, waitingElsewhere } from "../src/shoppingLists.ts";

const lists = [
  { id: "party", name: "Party", main: false, created: "2026-11-12 01:00:00.000Z" },
  { id: "main", name: "Shopping list", main: true, created: "2026-11-13 01:00:00.000Z" },
  { id: "tools", name: "Hardware", main: false, created: "2026-11-12 02:00:00.000Z" },
];
const row = (text: string, list = "", checked = false, pantry_item = "") => ({ text, list, checked, pantry_item });

test("the main list comes first, then the others in the order they were made", () => {
  assert.deepEqual(orderedLists(lists).map((l) => l.id), ["main", "party", "tools"]);
  assert.equal(mainListId(lists), "main");
  assert.equal(mainListId([]), "");
});

test("a new row on the main list saves no list, so it's found before the lists load", () => {
  assert.equal(storedList("main", "main"), "");
  assert.equal(storedList("party", "main"), "party");
  // Not loaded yet: the main list is "", and so is what's saved.
  assert.equal(storedList("", ""), "");
  assert.deepEqual(rowsOn([row("Candles", "party"), row("Milk", storedList("main", "main"))], "", "").map((r) => r.text), ["Milk"]);
});

test("a row with no list is on the main one (older apps, the server's 'ran out' add)", () => {
  assert.equal(listOf(row("Milk"), "main"), "main");
  assert.equal(listOf(row("Candles", "party"), "main"), "party");
  const rows = [row("Milk"), row("Candles", "party"), row("Bread", "main"), row("Ice", "party", true)];
  assert.deepEqual(rowsOn(rows, "main", "main").map((r) => r.text), ["Milk", "Bread"]);
  assert.equal(toBuyOn(rows, "party", "main"), 1);
});

test("something waiting on another list is found, so adding it asks first", () => {
  const rows = [row("Milk", "party"), row("Bread"), row("Eggs", "tools", true), row("2 L milk", "tools", false, "milk-item")];
  assert.equal(waitingElsewhere({ text: "milk", pantryItem: "" }, rows, "main", lists)?.name, "Party");
  // On this list already isn't "elsewhere" (the list refuses it as now).
  assert.equal(waitingElsewhere({ text: "Bread", pantryItem: "" }, rows, "main", lists), null);
  // Ticked off elsewhere: bought, so not waiting.
  assert.equal(waitingElsewhere({ text: "Eggs", pantryItem: "" }, rows, "main", lists), null);
  // By its pantry link, whatever the wording.
  assert.equal(waitingElsewhere({ text: "Milk", pantryItem: "milk-item" }, rows, "party", lists)?.name, "Hardware");
});

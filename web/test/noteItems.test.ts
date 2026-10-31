// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { noteBlocks } from "../src/noteItems.ts";

test("numbered notes become items, keeping the writer's numbers", () => {
  assert.deepEqual(noteBlocks("1. RICE – Best with long grain.\n2) IMPORTANT: Sub fresh veggies."), [
    { kind: "item", number: "1", lines: ["RICE – Best with long grain."] },
    { kind: "item", number: "2", lines: ["IMPORTANT: Sub fresh veggies."] },
  ]);
});

test("a number inside bold keeps the bold, and following lines join the item", () => {
  assert.deepEqual(noteBlocks("**5. Shiitake** – dried is best.\nSub fresh shiitake.\n**6. Gochujang** – spicy."), [
    { kind: "item", number: "5", lines: ["**Shiitake** – dried is best.", "Sub fresh shiitake."] },
    { kind: "item", number: "6", lines: ["**Gochujang** – spicy."] },
  ]);
});

test("dashes and bullets become items without numbers", () => {
  assert.deepEqual(noteBlocks("- Freezes well\n• Keeps 3 days\n* Double it"), [
    { kind: "item", number: null, lines: ["Freezes well"] },
    { kind: "item", number: null, lines: ["Keeps 3 days"] },
    { kind: "item", number: null, lines: ["Double it"] },
  ]);
});

test("other lines are paragraphs; a blank line ends an item; headings stay headings", () => {
  assert.deepEqual(noteBlocks("Some tips:\nfrom the writer\n\n# Storage\n1. Fridge 3 days\n\nEnjoy!"), [
    { kind: "text", lines: ["Some tips:", "from the writer"] },
    { kind: "heading", text: "Storage" },
    { kind: "item", number: "1", lines: ["Fridge 3 days"] },
    { kind: "text", lines: ["Enjoy!"] },
  ]);
});

test("amounts and soft words aren't mistaken for items", () => {
  assert.deepEqual(noteBlocks("1.5 cups is plenty\n2 eggs\n*optional* chives"), [
    { kind: "text", lines: ["1.5 cups is plenty", "2 eggs", "*optional* chives"] },
  ]);
  assert.deepEqual(noteBlocks(""), []);
});

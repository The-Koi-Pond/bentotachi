// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { OTHER, inCategory, movedTo, puttingOn, shelves, takingOff } from "../src/recipeCategories.ts";

test("putting a recipe on a shelf adds the shelf's first tag, once", () => {
  const mains = { tags: ["Main course", "mains", "dinner"] };
  assert.deepEqual(puttingOn(["quick"], mains), ["quick", "main course"]);
  assert.deepEqual(puttingOn(null, mains), ["main course"]);
  // Already on it through any of its tags: unchanged.
  assert.deepEqual(puttingOn(["Dinner", "quick"], mains), ["Dinner", "quick"]);
  // A shelf with no tags can't take recipes.
  assert.deepEqual(puttingOn(["quick"], { tags: [] }), ["quick"]);
});

test("taking a recipe off a shelf removes every tag that counts for it", () => {
  const mains = { tags: ["main course", "mains", "dinner"] };
  assert.deepEqual(takingOff(["Dinner", "quick", " Mains "], mains), ["quick"]);
  assert.deepEqual(takingOff(null, mains), []);
});

test("putting on and taking off leave the recipe's own list alone", () => {
  const tags = ["quick", "dinner"];
  puttingOn(tags, { tags: ["dessert"] });
  takingOff(tags, { tags: ["dinner"] });
  assert.deepEqual(tags, ["quick", "dinner"]);
});

test("dragging a shelf onto another puts it in that one's place", () => {
  const list = ["A", "B", "C", "D"].map((name, position) => ({ id: name, name, tags: [], position }));
  const names = (l: { name: string }[]) => l.map((c) => c.name).join("");
  assert.equal(names(movedTo(list, "A", "C")), "BCAD"); // down: lands after C
  assert.equal(names(movedTo(list, "D", "B")), "ADBC"); // up: lands before B
  assert.deepEqual(movedTo(list, "D", "B").map((c) => c.position), [0, 1, 2, 3]);
  assert.equal(names(movedTo(list, "B", "B")), "ABCD");
  assert.equal(names(movedTo(list, "B", "gone")), "ABCD");
});

const mains = { id: "m", name: "Mains", tags: ["main course", "mains"], position: 0 };
const desserts = { id: "d", name: "Desserts", tags: ["dessert"], position: 1 };
const recipe = (title: string, tags: string[] | null) => ({ title, tags });

test("a recipe is in a category when it has any of its tags, ignoring capitals", () => {
  assert.equal(inCategory(recipe("Curry", ["Main Course "]), mains), true);
  assert.equal(inCategory(recipe("Curry", ["mains", "indian"]), mains), true);
  assert.equal(inCategory(recipe("Cake", ["dessert"]), mains), false);
  assert.equal(inCategory(recipe("Toast", null), mains), false);
  assert.equal(inCategory(recipe("Toast", ["main"]), { tags: null }), false);
});

test("shelves come in order, a recipe can be on several, and the rest go last", () => {
  const list = [recipe("Curry", ["mains"]), recipe("Pudding", ["dessert", "main course"]), recipe("Toast", [])];
  const result = shelves(list, [desserts, mains]);
  assert.deepEqual(
    result.map((shelf) => [shelf.name, shelf.recipes.map((r) => r.title)]),
    [
      ["Mains", ["Curry", "Pudding"]],
      ["Desserts", ["Pudding"]],
      ["Everything else", ["Toast"]],
    ],
  );
  assert.equal(result[2].id, OTHER);
});

test("empty categories still get a shelf, but an empty 'Everything else' doesn't", () => {
  const result = shelves([recipe("Curry", ["mains"])], [mains, desserts]);
  assert.deepEqual(result.map((shelf) => [shelf.name, shelf.recipes.length]), [["Mains", 1], ["Desserts", 0]]);
});

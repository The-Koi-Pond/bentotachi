// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { dishesBySlot, dropSwaps, mealDrop, mealOf, mealsForDay, mealWord, parseSlot, plannedMeals, planTitle, slotKey } from "../src/meals.ts";

test("entries from before meals existed are dinners", () => {
  assert.equal(mealOf({}), "dinner");
  assert.equal(mealOf({ meal: "" }), "dinner");
  assert.equal(mealOf({ meal: "lunch" }), "lunch");
  assert.equal(mealOf({ meal: "supper" }), "dinner");
});

test("the household's meals, in plan order", () => {
  assert.deepEqual(plannedMeals([]), ["dinner"]);
  assert.deepEqual(plannedMeals(null), ["dinner"]);
  assert.deepEqual(plannedMeals(["dinner", "breakfast"]), ["breakfast", "dinner"]);
  assert.deepEqual(plannedMeals(["lunch"]), ["lunch"]);
});

test("a day also shows meals it already has", () => {
  assert.deepEqual(mealsForDay(["dinner"], () => false), ["dinner"]);
  assert.deepEqual(mealsForDay(["dinner"], (meal) => meal === "lunch"), ["lunch", "dinner"]);
  assert.deepEqual(mealsForDay(["breakfast", "dinner"], () => false), ["breakfast", "dinner"]);
});

test("slots as drag ids", () => {
  assert.equal(slotKey("2026-11-02", "lunch"), "2026-11-02|lunch");
  assert.deepEqual(parseSlot("2026-11-02|lunch"), { date: "2026-11-02", meal: "lunch" });
  assert.deepEqual(parseSlot("2026-11-02"), { date: "2026-11-02", meal: "dinner" });
});

test("a meal's dishes, in the order they were added", () => {
  const at = (id: string, date: string, created: string, meal?: string) => ({ id, date: `${date} 00:00:00.000Z`, created, meal });
  // Ids are random: the order is by when added, not by id ("zcurry" first).
  const slots = dishesBySlot([
    at("arice", "2026-11-02", "2026-11-01 10:00:02"),
    at("zcurry", "2026-11-02", "2026-11-01 10:00:01"),
    at("soup", "2026-11-02", "2026-11-01 09:00:00", "lunch"),
    // From before meals: a dinner.
    at("old", "2026-11-03", "2026-10-01 09:00:00"),
  ]);
  assert.deepEqual(slots.get("2026-11-02|dinner")?.map((e) => e.id), ["zcurry", "arice"]);
  assert.deepEqual(slots.get("2026-11-02|lunch")?.map((e) => e.id), ["soup"]);
  assert.deepEqual(slots.get("2026-11-03|dinner")?.map((e) => e.id), ["old"]);
});

test("a lone dish dropped on a lone dish swaps; otherwise it joins", () => {
  assert.equal(dropSwaps(1, 1), true);
  assert.equal(dropSwaps(1, 0), false);
  assert.equal(dropSwaps(1, 2), false, "a side dragged to a meal with two dishes joins them");
  assert.equal(dropSwaps(2, 1), false, "a side taken from its main joins the other meal");
});

test("a month cell's picture moves its whole meal; a lone dish onto a lone dish swaps", () => {
  assert.deepEqual(mealDrop(["curry"], ["pasta"]), { swap: ["curry", "pasta"] });
  assert.deepEqual(mealDrop(["curry"], []), { move: ["curry"] });
  // A main and its side go together, onto an empty day or one with a meal.
  assert.deepEqual(mealDrop(["curry", "rice"], []), { move: ["curry", "rice"] });
  assert.deepEqual(mealDrop(["curry", "rice"], ["pasta"]), { move: ["curry", "rice"] });
});

test("the plan's name follows its meals", () => {
  assert.equal(planTitle(["dinner"]), "Dinner plan");
  assert.equal(planTitle(["lunch", "dinner"]), "Meal plan");
  assert.equal(mealWord(["dinner"]), "dinner");
  assert.equal(mealWord(["breakfast", "dinner"]), "meal");
});

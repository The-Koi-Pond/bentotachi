// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { mealOf, mealsForDay, mealWord, parseSlot, plannedMeals, planTitle, slotKey } from "../src/meals.ts";

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

test("the plan's name follows its meals", () => {
  assert.equal(planTitle(["dinner"]), "Dinner plan");
  assert.equal(planTitle(["lunch", "dinner"]), "Meal plan");
  assert.equal(mealWord(["dinner"]), "dinner");
  assert.equal(mealWord(["breakfast", "dinner"]), "meal");
});

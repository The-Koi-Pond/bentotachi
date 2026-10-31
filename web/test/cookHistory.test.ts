// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { daysHad, lastHadByRecipe, nextPlanned } from "../src/cookHistory.ts";

const at = (date: string, recipe: string) => ({ date: `${date} 00:00:00.000Z`, recipe });
const today = "2026-10-31";

test("days had come from past plan nights and cooked days, each day once", () => {
  const plan = [at("2026-10-10", "soup"), at("2026-10-20", "soup"), at("2026-10-31", "soup"), at("2026-11-05", "soup"), at("2026-10-12", "pie")];
  const cooked = [at("2026-10-20", "soup"), at("2026-10-25", "soup"), at("2026-10-31", "pie")];
  // Tonight's plan isn't had yet; the 20th was planned and cooked: one day.
  assert.deepEqual(daysHad("soup", plan, cooked, today), ["2026-10-10", "2026-10-20", "2026-10-25"]);
  // Cooked today counts straight away.
  assert.deepEqual(daysHad("pie", plan, cooked, today), ["2026-10-12", "2026-10-31"]);
  assert.deepEqual(daysHad("cake", plan, cooked, today), []);
});

test("the chooser's last-had dates take the latest of either", () => {
  const plan = [at("2026-10-10", "soup"), at("2026-11-02", "soup"), at("2026-10-01", "pie")];
  const cooked = [at("2026-10-25", "soup"), at("2026-10-31", "cake")];
  const last = lastHadByRecipe(plan, cooked, today);
  assert.equal(last.get("soup"), "2026-10-25");
  assert.equal(last.get("pie"), "2026-10-01");
  assert.equal(last.get("cake"), "2026-10-31");
});

test("next planned skips tonight once it's been cooked", () => {
  const plan = [at("2026-10-31", "soup"), at("2026-11-07", "soup")];
  assert.equal(nextPlanned("soup", plan, [], today), "2026-10-31");
  assert.equal(nextPlanned("soup", plan, [at("2026-10-31", "soup")], today), "2026-11-07");
  assert.equal(nextPlanned("pie", plan, [], today), undefined);
});

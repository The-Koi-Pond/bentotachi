// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { sortRecipes } from "../src/recipeSort.ts";

const recipe = (id: string, title: string, created: string, total: number) => ({
  id,
  title,
  created,
  prep_minutes: 0,
  cook_minutes: 0,
  total_minutes: total,
});
const list = [
  recipe("a", "curry", "2026-10-01", 45),
  recipe("b", "Bao", "2026-10-20", 0),
  recipe("c", "Apple pie", "2026-10-10", 90),
  recipe("d", "Dal", "2026-10-05", 30),
];
const scores: Record<string, { stars: number | null; thumbs: number }> = {
  a: { stars: 4.5, thumbs: 0 },
  b: { stars: null, thumbs: 2 },
  c: { stars: 4.5, thumbs: 1 },
  d: { stars: 3, thumbs: 0 },
};
const titles = (order: Parameters<typeof sortRecipes>[1]) =>
  sortRecipes(list, order, (r) => scores[r.id]).map((r) => r.title);

test("A–Z ignores capitals", () => {
  assert.deepEqual(titles("title"), ["Apple pie", "Bao", "curry", "Dal"]);
});

test("top rated: stars, then thumbs up, unrated last", () => {
  assert.deepEqual(titles("rating"), ["Apple pie", "curry", "Dal", "Bao"]);
});

test("newest first", () => {
  assert.deepEqual(titles("newest"), ["Bao", "Apple pie", "Dal", "curry"]);
});

test("quickest first, recipes without a time last", () => {
  assert.deepEqual(titles("quickest"), ["Dal", "curry", "Apple pie", "Bao"]);
});

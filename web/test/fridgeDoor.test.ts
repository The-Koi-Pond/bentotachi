// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { happenings, newestCreated, noteAge, planSummary, randomSplash, shortList, SPLASH_LINES, unreadNotes } from "../src/fridgeDoor.ts";

test("a splash line is one of the list, first to last", () => {
  assert.equal(randomSplash(() => 0), SPLASH_LINES[0]);
  assert.equal(randomSplash(() => 0.9999), SPLASH_LINES[SPLASH_LINES.length - 1]);
});

const note = (added_by: string, created: string) => ({ added_by, created });

test("unread notes are other people's, newer than the last visit", () => {
  const all = [note("me", "2026-11-04 10:00:00.000Z"), note("lilly", "2026-11-04 09:00:00.000Z"), note("kate", "2026-11-03 09:00:00.000Z")];
  assert.equal(unreadNotes(all, "me", ""), 2, "never opened: everyone else's");
  assert.equal(unreadNotes(all, "me", "2026-11-03 09:00:00.000Z"), 1, "only the one after the visit");
  assert.equal(unreadNotes(all, "me", "2026-11-04 10:00:00.000Z"), 0, "your own never count");
  assert.equal(newestCreated(all), "2026-11-04 10:00:00.000Z");
  assert.equal(newestCreated([]), "");
});

test("a note's age, in plain words", () => {
  // Local times, so the test works in any time zone.
  const now = new Date(2026, 10, 4, 18, 0);
  const at = (d: Date) => d.toISOString().replace("T", " ");
  assert.equal(noteAge(at(new Date(2026, 10, 4, 17, 59, 40)), now), "just now");
  assert.equal(noteAge(at(new Date(2026, 10, 4, 17, 40)), now), "20 min ago");
  assert.equal(noteAge(at(new Date(2026, 10, 4, 9, 0)), now), "9 h ago");
  assert.equal(noteAge(at(new Date(2026, 10, 3, 22, 0)), now), "yesterday", "last night is yesterday, not 20 h ago");
  assert.equal(noteAge(at(new Date(2026, 10, 1, 12, 0)), now), "3 days ago");
  assert.equal(noteAge("", now), "");
});

const entry = (date: string, meal = "dinner") => ({ date: `${date} 00:00:00.000Z`, meal });

test("the plan summary counts the next 7 days, from today", () => {
  const today = "2026-11-04";
  const plan = [entry("2026-11-03"), entry("2026-11-04"), entry("2026-11-06"), entry("2026-11-10"), entry("2026-11-11"), entry("2026-11-05", "lunch")];
  assert.equal(planSummary(plan, today, ["dinner"]), "3 of the next 7 dinners are planned.", "yesterday, the 11th and lunches don't count");
  assert.equal(planSummary(plan, today, ["lunch", "dinner"]), "4 of the next 14 meals are planned.");
  assert.equal(planSummary([entry("2026-11-04")], today, ["dinner"]), "1 of the next 7 dinners is planned.");
  // A dinner with its side is still one dinner.
  assert.equal(planSummary([entry("2026-11-04"), entry("2026-11-04")], today, ["dinner"]), "1 of the next 7 dinners is planned.");
  // But a day's lunch and dinner are two meals.
  assert.equal(
    planSummary([entry("2026-11-04", "lunch"), entry("2026-11-04")], today, ["lunch", "dinner"]),
    "2 of the next 14 meals are planned."
  );
  assert.equal(planSummary([], today, ["dinner"]), "Nothing planned for the next 7 days yet.");
  const week = Array.from({ length: 7 }, (_, i) => entry(`2026-11-${String(4 + i).padStart(2, "0")}`));
  assert.equal(planSummary(week, today, ["dinner"]), "Every dinner for the next 7 days is planned.");
  assert.equal(planSummary([{ date: "2026-11-05 00:00:00.000Z" }], today, ["dinner"]), "1 of the next 7 dinners is planned.", "no meal means dinner");
});

test("short lists name a few, then count the rest", () => {
  assert.equal(shortList(["Milk"]), "Milk");
  assert.equal(shortList(["onions", "Milk"]), "Milk and onions");
  assert.equal(shortList(["eggs", "Milk", "onions"]), "eggs, Milk and onions");
  assert.equal(shortList(["a", "b", "c", "d", "e", "f"]), "a, b, c, d and 2 more");
});

test("lately: recipes added and cooked, newest first, a few at most", () => {
  const added = [{ id: "r1", created: "2026-11-02 10:00:00.000Z", added_by: "lilly", title: "Soup" }];
  const cooked = [
    { id: "c1", created: "2026-11-03 19:00:00.000Z", cooked_by: "me", recipe: "r1", title: "Soup" },
    { id: "c2", created: "2026-11-01 19:00:00.000Z", cooked_by: "kate", recipe: "r2", title: "Stew" },
  ];
  assert.deepEqual(
    happenings(added, cooked).map((h) => `${h.kind} ${h.title} ${h.who} ${h.recipeId}`),
    ["cooked Soup me r1", "added Soup lilly r1", "cooked Stew kate r2"]
  );
  assert.equal(happenings(added, cooked, 2).length, 2);
});

// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  groupItems,
  itemExpiry,
  matchesPantrySearch,
  needsChecking,
  needsUsingSoon,
  placeOptions,
  subcategoryOptions,
  uniqueLabels,
} from "../src/pantryGroups.ts";

const item = (name: string, location: string, subcategory = "", extra = {}) => ({
  name,
  location,
  subcategory,
  opened_location: "",
  opened: false,
  ...extra,
});

test("items go in drawers by place and subcategory, A to Z, ignoring capitals", () => {
  const groups = groupItems([
    item("Milk", "fridge", "Dairy"),
    item("Butter", "Fridge", "dairy"),
    item("Flour", "Cupboard", "Baking"),
    item("Eggs", "Fridge"),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.label, g.subgroups.map((s) => [s.label, s.items.map((i) => i.name)])]),
    [
      ["Cupboard", [["Baking", ["Flour"]]]],
      // No subcategory first; the first spelling of a place or subcategory wins.
      ["fridge", [["", ["Eggs"]], ["Dairy", ["Butter", "Milk"]]]],
    ],
  );
  assert.equal(groups[1].subgroups[1].key, "fridge/dairy");
});

test("items with no place go last, under Other", () => {
  const groups = groupItems([item("Mystery", " "), item("Rice", "Cupboard")]);
  assert.deepEqual(groups.map((g) => g.label), ["Cupboard", "Other"]);
});

test("an opened item sits in its once-opened place", () => {
  const groups = groupItems([item("Sauce", "Cupboard", "Tins & jars", { opened_location: "Fridge", opened: true })]);
  assert.deepEqual(groups.map((g) => [g.label, g.subgroups[0].label]), [["Fridge", ""]]);
});

test("places offered: the starters plus the household's own, once each", () => {
  const places = placeOptions([item("Ice", "freezer"), item("Wine", "Wine rack", "", { opened_location: "Door shelf" })]);
  assert.deepEqual(places, ["Cupboard", "Door shelf", "Freezer", "Fridge", "Wine rack"]);
});

test("subcategories offered belong to the chosen place", () => {
  const existing = [item("Kimchi", "Fridge", "Ferments"), item("Lentils", "Cupboard", "Pulses")];
  const fridge = subcategoryOptions(existing, "fridge");
  assert.ok(fridge.includes("Ferments") && fridge.includes("Dairy"));
  assert.ok(!fridge.includes("Pulses"));
  assert.deepEqual(subcategoryOptions(existing, " "), []);
});

test("labels: no blanks or case-only repeats, A to Z", () => {
  assert.deepEqual(uniqueLabels(["Fridge", "fridge ", "", "  ", "Cupboard"]), ["Cupboard", "Fridge"]);
});

test("expiry only counts for things still here", () => {
  const long_ago = "2000-01-01 00:00:00.000Z";
  const far_off = "2999-01-01 00:00:00.000Z";
  assert.equal(itemExpiry({ status: "have", expires: long_ago }), "expired");
  assert.equal(itemExpiry({ status: "low", expires: far_off }), "later");
  assert.equal(itemExpiry({ status: "out", expires: long_ago }), null);
  assert.equal(itemExpiry({ status: "have", expires: "" }), null);
  assert.equal(needsUsingSoon({ status: "have", expires: long_ago }), true);
  assert.equal(needsUsingSoon({ status: "have", expires: far_off }), false);
});

test("use soon: expired, or within the next few days", () => {
  const now = new Date(2026, 10, 2, 12); // 2 Nov 2026, midday, this computer's time
  const on = (date: string) => ({ status: "have" as const, expires: `${date} 00:00:00.000Z` });
  assert.equal(needsUsingSoon(on("2026-11-02"), now), true); // today
  assert.equal(needsUsingSoon(on("2026-11-03"), now), true); // tomorrow
  assert.equal(needsUsingSoon(on("2026-11-05"), now), true); // in 3 days
  assert.equal(needsUsingSoon(on("2026-11-06"), now), false); // in 4 days
  assert.equal(needsUsingSoon(on("2026-11-01"), now), true); // yesterday
  assert.equal(itemExpiry(on("2026-11-03"), now), "soon");
  assert.equal(needsChecking(on("2026-11-03"), now), true);
  assert.equal(needsChecking(on("2026-11-20"), now), false);
});

test("to check: low, out, or to use up soon", () => {
  assert.equal(needsChecking({ status: "low", expires: "" }), true);
  assert.equal(needsChecking({ status: "out", expires: "" }), true);
  assert.equal(needsChecking({ status: "have", expires: "2000-01-01 00:00:00.000Z" }), true);
  assert.equal(needsChecking({ status: "have", expires: "2999-01-01 00:00:00.000Z" }), false);
  assert.equal(needsChecking({ status: "have", expires: "" }), false);
});

test("the find box matches names and brands, every word, ignoring capitals", () => {
  const flour = { name: "Plain flour", brand: "White Mill" };
  assert.equal(matchesPantrySearch(flour, "FLOUR"), true);
  assert.equal(matchesPantrySearch(flour, "white"), true);
  assert.equal(matchesPantrySearch(flour, "mill plain"), true);
  assert.equal(matchesPantrySearch(flour, "rice"), false);
  assert.equal(matchesPantrySearch(flour, "  "), true);
  assert.equal(matchesPantrySearch({ name: "Eggs", brand: "" }, "eg"), true);
});

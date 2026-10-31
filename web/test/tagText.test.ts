// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { suggestTags, tagsFromContent, tagsIn, typedTag, withTag, withoutTags } from "../src/tagText.ts";

test("suggests known tags the recipe mentions", () => {
  const known = ["american", "beef", "noodles", "rice", "mushroom", "korean", "one-pot", "chicken"];
  const content = [
    "One-Pot Korean Beef Noodles",
    "A quick weeknight dinner.",
    "500 g beef mince",
    "200 g egg noodle",
    "2 tbsp rice vinegar",
    "150 g mushrooms, sliced",
  ].join("\n");
  assert.deepEqual(tagsFromContent(known, content, ""), ["beef", "noodles", "mushroom", "korean", "one-pot"]);
  // Already in the box: not suggested again.
  assert.deepEqual(tagsFromContent(known, content, "beef, Korean"), ["noodles", "mushroom", "one-pot"]);
  assert.deepEqual(tagsFromContent(known, "", ""), []);
});

test("suggests one of a singular and plural, and not one already there", () => {
  assert.deepEqual(tagsFromContent(["appetiser", "appetisers"], "A lovely appetiser", ""), ["appetiser"]);
  assert.deepEqual(tagsFromContent(["mushroom", "mushrooms"], "100 g mushrooms", "mushrooms"), []);
});

const used = ["american", "main", "beef", "noodles", "mushroom", "mushrooms", "veggies"];

test("suggestions narrow to a half-typed tag", () => {
  assert.deepEqual(suggestTags(used, "beef, noo"), { tags: ["noodles"], narrowing: true });
});

test("a finished last tag doesn't hide the suggestions", () => {
  // "mushroom" is a whole tag already, so everything else is suggested.
  assert.deepEqual(suggestTags(used, "main, beef, mushroom"), { tags: ["american", "noodles", "mushrooms", "veggies"], narrowing: false });
  // A new word matching nothing is finished too.
  assert.deepEqual(suggestTags(used, "beef, spicy"), { tags: ["american", "main", "noodles", "mushroom", "mushrooms", "veggies"], narrowing: false });
});

test("picking after a finished tag keeps it", () => {
  assert.equal(withTag("main, beef, mushroom", "noodles", false), "main, beef, mushroom, noodles, ");
});

test("reads the tags in the box and the one being typed", () => {
  assert.deepEqual(tagsIn("Quick, vegetarian, , dinn"), ["quick", "vegetarian", "dinn"]);
  assert.equal(typedTag("quick, Veg"), "veg");
  assert.equal(typedTag("quick, "), "");
  assert.equal(typedTag(""), "");
});

test("picking a suggestion finishes the half-typed tag", () => {
  assert.equal(withTag("quick, veg", "vegetarian", true), "quick, vegetarian, ");
  assert.equal(withTag("", "dinner", true), "dinner, ");
});

test("picking a shelf keeps what's typed and doesn't double up", () => {
  assert.equal(withTag("quick, spicy", "one-pot", false), "quick, spicy, one-pot, ");
  assert.equal(withTag("One-Pot, quick", "one-pot", false), "quick, one-pot, ");
});

test("taking a shelf off removes all of its tags", () => {
  assert.equal(withoutTags("Mains, quick, main course, ", ["main course", "mains"]), "quick");
});

// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { otherNames, searchVariants, withRegionalHint } from "../src/regionalNames.ts";
import { guessPantryItem } from "../src/pantryLinks.ts";

const item = (id: string, name: string) => ({ id, name }) as never;

test("a pantry item links to the other country's name for it", () => {
  const pantry = [item("cap", "Capsicum"), item("cil", "Cilantro"), item("cor", "Coriander"), item("ground", "Ground coriander")];
  const guess = (line: string) => (guessPantryItem(line, pantry) as { id: string } | null)?.id ?? null;
  assert.equal(guess("1 red bell pepper, sliced"), "cap");
  assert.equal(guess("2 bell peppers"), "cap");
  // A US pantry's "Cilantro" for an Australian recipe's fresh coriander.
  assert.equal(guessPantryItem("1/4 cup fresh coriander leaves", [item("cil", "Cilantro")])?.["id" as never], "cil");
  // An Australian "Coriander" is the leaves, so a US recipe's cilantro is it.
  assert.equal(guessPantryItem("1/2 cup cilantro, chopped", [item("cor", "Coriander")])?.["id" as never], "cor");
  // A US "Cilantro" isn't ground coriander, and "Ground coriander" wins its own line.
  assert.equal(guessPantryItem("1 tsp coriander", [item("cil", "Cilantro")]), null);
  assert.equal(guess("1 tsp ground coriander"), "ground");
});

test("other names swap the regional word inside a longer name", () => {
  assert.deepEqual(otherNames("Red capsicum"), ["Red bell pepper", "Red sweet pepper"]);
  assert.deepEqual(otherNames("Ground beef"), ["beef mince", "minced beef"]);
  assert.deepEqual(otherNames("Onion"), []);
});

test("search looks for the other country's word too, kept as one phrase", () => {
  assert.deepEqual(searchVariants("Capsicum soup"), [
    ["capsicum", "soup"],
    ["bell pepper", "soup"],
    ["sweet pepper", "soup"],
  ]);
  const joined = (text: string) => searchVariants(text).map((words) => words.join(" "));
  assert.ok(joined("coriander").includes("cilantro"));
  assert.ok(!joined("cilantro").includes("coriander"));
});

test("a swapped search only finds the phrase, not its words apart", () => {
  const variants = searchVariants("capsicum");
  const hasAll = (text: string) => variants.some((words) => words.every((word) => text.includes(word)));
  assert.equal(hasAll("1 red bell pepper"), true);
  // "sweet potato" and "black pepper" in one recipe isn't a capsicum.
  assert.equal(hasAll("2 sweet potatoes, salt and black pepper"), false);
});

test("hints show the household's word after the other country's", () => {
  assert.equal(withRegionalHint("1 red bell pepper, diced", "AU"), "1 red bell pepper *(capsicum)*, diced");
  assert.equal(withRegionalHint("1/4 cup cilantro", "AU"), "1/4 cup cilantro *(coriander)*");
  assert.equal(withRegionalHint("500 g beef mince", "US"), "500 g beef mince *(ground beef)*");
  assert.equal(withRegionalHint("2 cups plain flour and 1 tsp bicarb soda", "US"), "2 cups plain flour *(all-purpose flour)* and 1 tsp bicarb soda *(baking soda)*");
});

test("no hint where the meaning isn't certain, or the word is already ours", () => {
  assert.equal(withRegionalHint("1 tsp ground coriander", "US"), "1 tsp ground coriander");
  assert.equal(withRegionalHint("3 cloves garlic, minced", "US"), "3 cloves garlic, minced");
  assert.equal(withRegionalHint("1 tbsp shrimp paste", "AU"), "1 tbsp shrimp paste");
  assert.equal(withRegionalHint("1 bell pepper (capsicum)", "AU"), "1 bell pepper (capsicum)");
  assert.equal(withRegionalHint("1 can chickpeas", "US"), "1 can chickpeas");
  assert.equal(withRegionalHint("1 can garbanzo beans", "AU"), "1 can garbanzo beans *(chickpea)*");
  assert.equal(withRegionalHint("1 red bell pepper", "OTHER"), "1 red bell pepper");
});

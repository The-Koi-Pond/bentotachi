// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  carriedLinks,
  familyLinkValue,
  familyStatus,
  guessPantryItem,
  linkedItems,
  linkFor,
  linkKey,
  linkStatus,
  linkTarget,
  missingFromPantry,
  pantryCheck,
  sameLinks,
  suggestedName,
} from "../src/pantryLinks.ts";

const item = (id: string, name: string) => ({ id, name, status: "have" }) as never;
const pantry = [
  item("onion", "Onion"),
  item("eggs", "Eggs"),
  item("tomatoes", "Tomatoes"),
  item("chicken", "Chicken"),
  item("stock", "Chicken stock"),
  item("salt", "Salt"),
  item("rice", "Rice"),
  item("chickpeas", "Chickpeas"),
];
const guess = (line: string) => (guessPantryItem(line, pantry) as { id: string } | null)?.id ?? null;

test("guesses pantry items from ingredient lines, allowing plurals", () => {
  assert.equal(guess("2 onions, diced"), "onion");
  assert.equal(guess("1 egg"), "eggs");
  assert.equal(guess("3 large eggs (50 g each)"), "eggs");
  assert.equal(guess("400g tin of tomatoes"), "tomatoes");
  assert.equal(guess("1 tomato, chopped"), "tomatoes");
  assert.equal(guess("1 tin chickpeas"), "chickpeas");
  assert.equal(guess("1 cup Rice"), "rice");
});

test("prefers the longest matching name", () => {
  assert.equal(guess("500ml chicken stock"), "stock");
  assert.equal(guess("2 chicken thighs"), "chicken");
});

test("only matches whole words", () => {
  assert.equal(guess("1 eggplant, sliced"), null);
  assert.equal(guess("50g unsalted butter"), null);
  assert.equal(guess("a pinch of salt"), "salt");
  assert.equal(guess("water"), null);
});

test("a name that only describes something else isn't it", () => {
  assert.equal(guess("200 g risoni (rice-shaped pasta)"), null);
  assert.equal(guess("an egg-sized knob of butter"), null);
  // A hyphen joining other words still names it, and so does a describing
  // word after a space.
  assert.equal(guess("1 cup rice - rinsed"), "rice");
  assert.equal(guess("2 eggs, size 7"), "eggs");
  // A stand-in links to the real thing.
  assert.equal(guess("2 cups onion-style crispy shallots"), "onion");
});

test("a chosen link beats a guess; an empty choice means not a pantry item", () => {
  const line = "2 onions, diced";
  assert.deepEqual(linkFor(line, null, pantry), { kind: "guessed", item: pantry[0], family: null });
  assert.deepEqual(linkFor(line, { [linkKey(line)]: "rice" }, pantry), { kind: "chosen", item: pantry[6], family: null });
  assert.deepEqual(linkFor(line, { [linkKey(line)]: "" }, pantry), { kind: "notPantry", item: null, family: null });
  assert.deepEqual(linkFor("water", null, pantry), { kind: "unmatched", item: null, family: null });
});

test("falls back to a guess when the chosen item was deleted", () => {
  const line = "2 onions, diced";
  assert.deepEqual(linkFor(line, { [linkKey(line)]: "gone" }, pantry), { kind: "guessed", item: pantry[0], family: null });
});

const kind = (id: string, name: string, of: string, status = "have") => ({ id, name, status, kind_of: of }) as never;
const pastas = [kind("lin", "Linguine", "Pasta"), kind("pen", "Penne", "Pasta", "low"), kind("spa", "Spaghetti", "pasta", "out")];

test("kinds of one thing: a line naming a kind links to that kind only", () => {
  const link = linkFor("400 g linguine", null, pastas);
  assert.equal(link.item?.name, "Linguine");
  // Naming the group too doesn't widen it.
  assert.equal(linkFor("12 oz linguine pasta", null, pastas).item?.name, "Linguine");
});

test("kinds of one thing: a kind that isn't in the pantry isn't covered by another", () => {
  assert.equal(linkFor("300 g orzo", null, pastas).kind, "unmatched");
  // An unknown kind before the group's name isn't "any pasta" either.
  assert.equal(linkFor("500 g bucatini pasta", null, pastas).kind, "unmatched");
});

test("kinds of one thing: a line naming just the group takes any kind, as one group", () => {
  for (const line of ["500 g pasta", "1 lb dried pasta", "a packet of pasta", "Pasta, to serve"]) {
    const link = linkFor(line, null, pastas);
    assert.equal(link.family?.name, "Pasta", line);
    // "pasta" and "Pasta" are the same group.
    assert.deepEqual(link.family?.items.map((i) => (i as { id: string }).id), ["lin", "pen", "spa"], line);
  }
  assert.equal(linkStatus(linkFor("500 g pasta", null, pastas)), "have");
  assert.equal(linkTarget(linkFor("500 g pasta", null, pastas)), "kind:pasta");
});

test("kinds of one thing: 'any' is read through the ways recipes write amounts", () => {
  const beans = [kind("bb", "Black beans", "Beans"), kind("kb", "Kidney beans", "Beans")];
  for (const line of ["500g pasta", "1kg pasta", "8oz pasta", "1 lb. pasta", "500g/1lb pasta", "8 ounces (225g) pasta", "500 g **pasta**", "1 box pasta", "2 x 500g pasta"]) {
    assert.equal(linkFor(line, null, pastas).family?.name, "Pasta", line);
  }
  for (const line of ["1 can beans, drained", "2 x 400g tins beans", "400g tin beans"]) {
    assert.equal(linkFor(line, null, beans).family?.name, "Beans", line);
  }
  // Still not "any" with a kind's name before the group's, or with only
  // punctuation between them.
  for (const line of ["500g bucatini pasta", "300 g orzo (pasta)", "bucatini/pasta"]) {
    assert.equal(linkFor(line, null, pastas).kind, "unmatched", line);
  }
});

test("kinds of one thing: an item named as its own group stands for the group", () => {
  const withOdds = [...pastas, kind("odd", "Pasta", "Pasta", "out")];
  const link = linkFor("500 g pasta", null, withOdds);
  assert.equal(link.family?.name, "Pasta");
  assert.equal(linkStatus(link), "have");
});

test("kinds of one thing: the dinner chooser counts a group line, and every kind out makes it out", () => {
  const recipe = { ingredients: ["500 g pasta", "2 onions"], ingredient_links: null };
  const allOut = [kind("lin", "Linguine", "Pasta", "out"), kind("pen", "Penne", "Pasta", "out")];
  const check = pantryCheck(recipe, allOut);
  assert.equal(check.linked, 1);
  assert.deepEqual(check.out.map((i) => (i as { id: string }).id).sort(), ["lin", "pen"]);
  assert.deepEqual(pantryCheck(recipe, pastas).out, []);
});

test("kinds of one thing: 'any of these' can be chosen for a line, and is kept while a kind is left", () => {
  const line = "400 g linguine";
  const chosen = linkFor(line, { [linkKey(line)]: familyLinkValue("Pasta") }, pastas);
  assert.equal(chosen.kind, "chosen");
  assert.equal(chosen.family?.name, "Pasta");
  assert.deepEqual(linkedItems(chosen).length, 3);
  // No kinds of it left: back to a guess.
  assert.equal(linkFor(line, { [linkKey(line)]: familyLinkValue("Pasta") }, [kind("lin", "Linguine", "")]).item?.name, "Linguine");
});

test("a group's level: Have if any kind is had, else Low if any is low, else Out", () => {
  assert.equal(familyStatus([{ status: "out" }, { status: "have" }]), "have");
  assert.equal(familyStatus([{ status: "out" }, { status: "low" }]), "low");
  assert.equal(familyStatus([{ status: "out" }]), "out");
  // "Missing from pantry" for "any pasta" asks the group.
  assert.equal(missingFromPantry(linkFor("500 g pasta", null, pastas)), false);
  assert.equal(missingFromPantry(linkFor("500 g pasta", null, [kind("spa", "Spaghetti", "Pasta", "out")])), true);
});

test("suggests a name for a new pantry item", () => {
  assert.equal(suggestedName("2 large onions, diced"), "Onions");
  assert.equal(suggestedName("1 tin chickpeas"), "Chickpeas");
  assert.equal(suggestedName("½ yellow onion ((4 oz, 113 g; peeled))"), "Yellow onion");
  assert.equal(suggestedName("2 cloves garlic"), "Garlic");
  assert.equal(suggestedName("1 tbsp sake"), "Sake");
  assert.equal(suggestedName("salt"), "Salt");
});

test("checks a recipe against the pantry: low counts as having some", () => {
  const stocked = [item("onion", "Onion"), { id: "rice", name: "Rice", status: "out" } as never, { id: "eggs", name: "Eggs", status: "low" } as never];
  const check = (ingredients: string[], links: Record<string, string> | null = null) => {
    const result = pantryCheck({ ingredients, ingredient_links: links }, stocked);
    return [result.linked, result.out.map((i) => (i as { name: string }).name)];
  };
  assert.deepEqual(check(["# Base", "2 onions", "1 cup rice", "rice for serving", "2 eggs", "water"]), [4, ["Rice"]]);
  assert.deepEqual(check(["2 onions", "2 eggs"]), [2, []]);
  assert.deepEqual(check(["water", "magic"]), [0, []]);
  assert.deepEqual(check(["1 cup rice"], { "1 cup rice": "" }), [0, []]);
});

test("doesn't link a name that's only part of a different product", () => {
  const shelf = [
    item("rice", "Rice"), item("milk", "Milk"), item("garlic", "Garlic"), item("chicken", "Chicken"),
    item("tomatoes", "Tomatoes"), item("butter", "Butter"), item("eggs", "Eggs"), item("flour", "Flour"),
    item("lemons", "Lemons"), item("cream", "Cream"), item("cheese", "Cheese"),
  ];
  const g = (line: string) => (guessPantryItem(line, shelf) as { id: string } | null)?.id ?? null;
  // Different products: no guess.
  assert.equal(g("2 tbsp rice vinegar"), null);
  assert.equal(g("1 can coconut milk"), null);
  assert.equal(g("1 tsp garlic powder"), null);
  assert.equal(g("500ml chicken stock"), null);
  assert.equal(g("2 tbsp tomato paste"), null);
  assert.equal(g("3 tbsp peanut butter"), null);
  assert.equal(g("200g egg noodles"), null);
  assert.equal(g("1 cup almond flour"), null);
  assert.equal(g("½ cup sour cream"), null);
  assert.equal(g("100g cream cheese"), null);
  // The same things on their own, or just described, still match.
  assert.equal(g("1 cup brown rice"), "rice");
  assert.equal(g("2 chicken breasts"), "chicken");
  assert.equal(g("1 cup milk"), "milk");
  assert.equal(g("3 cloves garlic, minced"), "garlic");
  assert.equal(g("juice of 2 lemons"), "lemons");
  assert.equal(g("rice, to serve"), "rice");
  // A line can still match where the name appears a second time on its own.
  assert.equal(g("rice vinegar, for the rice"), "rice");
});

test("a pantry item named for the product still matches it", () => {
  const shelf = [item("rice", "Rice"), item("vinegar", "Rice vinegar")];
  assert.equal((guessPantryItem("2 tbsp rice vinegar", shelf) as { id: string }).id, "vinegar");
  assert.equal((guessPantryItem("1 cup rice", shelf) as { id: string }).id, "rice");
});

test("a reworded ingredient keeps its link, or its 'not a pantry item'", () => {
  const before = ["2 onions", "1 cup rice", "water"];
  const links = { "2 onions": "brown-onion", "1 cup rice": "", water: "" };
  assert.deepEqual(carriedLinks(before, ["3 onions", "1.5 cups rice", "water"], links), {
    "3 onions": "brown-onion",
    "1.5 cups rice": "",
    water: "",
  });
  // A different thing in its place isn't the same ingredient.
  assert.deepEqual(carriedLinks(before, ["1 leek", "1 cup rice", "water"], links), { "1 cup rice": "", water: "" });
  // Amounts, plurals and notes aside, it's still onions.
  assert.deepEqual(carriedLinks(["2 onions, diced"], ["3 Onion, sliced"], { "2 onions, diced": "o" }), {
    "3 onion, sliced": "o",
  });
});

test("a reworded line never takes a different ingredient's link", () => {
  const one = (from: string, to: string, link = "x") => carriedLinks([from], [to], { [from.toLowerCase()]: link });
  // One word in common isn't the same thing.
  assert.deepEqual(one("2 tbsp soy sauce", "1 tbsp fish sauce"), {});
  assert.deepEqual(one("juice of 1 lemon", "zest of 1 orange"), {});
  assert.deepEqual(one("salt and pepper", "oil and vinegar", ""), {});
  assert.deepEqual(one("1 tbsp olive oil", "1 tbsp sesame oil"), {});
  // A more particular kind is a guess too ("Onions" might be the brown ones).
  assert.deepEqual(one("2 onions", "2 red onions"), {});
  // A line removed above a reworded one: the places don't line up any more.
  const oils = { "1 tbsp olive oil": "olive", "2 tbsp vegetable oil": "veg" };
  assert.deepEqual(carriedLinks(["1 tbsp olive oil", "2 tbsp vegetable oil", "salt"], ["3 tbsp vegetable oil", "salt"], oils), {});
  const chicken = { "500 g chicken thighs": "thighs", "1 cup chicken stock": "stock" };
  assert.deepEqual(carriedLinks(["500 g chicken thighs", "1 cup chicken stock"], ["2 cups chicken stock"], chicken), {});
  // Two lines of the same name: once one goes, the
  // other can't be told apart, so neither carries.
  const tins = { "1 can tomatoes, crushed": "crushed", "1 can tomatoes, diced": "diced" };
  assert.deepEqual(carriedLinks(["1 can tomatoes, crushed", "1 can tomatoes, diced"], ["2 cans tomatoes, diced"], tins), {});
  assert.deepEqual(
    carriedLinks(["1 can tomatoes, diced"], ["1 can tomatoes, crushed", "2 cans tomatoes, diced"], { "1 can tomatoes, diced": "diced" }),
    {}
  );
  const flours = { "1 cup flour (plain)": "plain", "1 cup flour (self-raising)": "sr" };
  assert.deepEqual(carriedLinks(["1 cup flour (plain)", "1 cup flour (self-raising)"], ["2 cups flour (self-raising)"], flours), {});
  // A line added above: neither line takes the other's link.
  assert.deepEqual(
    carriedLinks(["1 cup chicken stock"], ["500 g chicken thighs", "2 cups chicken stock"], { "1 cup chicken stock": "stock" }),
    {}
  );
});

test("unchanged lines keep their links, and gone lines lose theirs", () => {
  const links = { "2 onions": "onion", "1 cup rice": "rice", "a pinch of salt": "" };
  // Nothing changed: the same links.
  const same = ["2 onions", "1 cup rice", "a pinch of salt"];
  assert.deepEqual(carriedLinks(same, same, links), links);
  // Rice removed: its key goes, and salt's link doesn't slide onto anything.
  assert.deepEqual(carriedLinks(same, ["2 onions", "a pinch of salt"], links), { "2 onions": "onion", "a pinch of salt": "" });
  // Moved about: they follow their own wording.
  assert.deepEqual(carriedLinks(same, ["a pinch of salt", "2 onions", "1 cup rice"], links), links);
  // A key left from an old wording is tidied away.
  assert.deepEqual(carriedLinks(["2 onions"], ["2 onions"], { "2 onions": "onion", "3 onions": "onion" }), {
    "2 onions": "onion",
  });
  assert.deepEqual(carriedLinks(["2 onions"], ["2 onions"], null), {});
});

test("a line added or removed above a reworded one stops its link moving", () => {
  const links = { "1 carrot": "carrot", "2 onions": "onion" };
  // Added on top: the onions line has moved, so it can't be told from a new
  // line; nothing lands on the new line either.
  assert.deepEqual(carriedLinks(["1 carrot", "2 onions"], ["1 tsp onion powder", "1 carrot", "3 onions"], links), {
    "1 carrot": "carrot",
  });
  // The carrot removed and the onions reworded: the carrot's link doesn't
  // land on the onions (a different thing).
  assert.deepEqual(carriedLinks(["1 carrot", "2 onions"], ["3 onions"], links), {});
  // Added below a reworded line: it stayed in place, so it keeps its link.
  assert.deepEqual(carriedLinks(["1 carrot", "2 onions"], ["2 carrots", "2 onions", "1 leek"], links), {
    "2 carrots": "carrot",
    "2 onions": "onion",
  });
});

test("headings don't count as places or carry links", () => {
  const links = { "2 onions": "onion", "1 cup rice": "rice" };
  // A heading added above doesn't move the ingredients.
  assert.deepEqual(carriedLinks(["2 onions", "1 cup rice"], ["# Base", "3 onions", "# To serve", "2 cups rice"], links), {
    "3 onions": "onion",
    "2 cups rice": "rice",
  });
  // A heading's key (headings never get links) isn't kept or carried.
  assert.deepEqual(carriedLinks(["# Onions", "2 onions"], ["# More onions", "2 onions"], { "# onions": "x", ...links }), {
    "2 onions": "onion",
  });
});

test("tells whether the links changed", () => {
  assert.equal(sameLinks({ a: "1", b: "" }, { b: "", a: "1" }), true);
  assert.equal(sameLinks({}, null), true);
  assert.equal(sameLinks({ a: "1" }, { a: "" }), false);
  assert.equal(sameLinks({ a: "1" }, { a: "1", b: "2" }), false);
});

test("missing from the pantry: low, out, or not in it; not what we have or water", () => {
  const stocked = [item("onion", "Onion"), { id: "rice", name: "Rice", status: "out" } as never, { id: "eggs", name: "Eggs", status: "low" } as never];
  const missing = (line: string, links?: Record<string, string>) => missingFromPantry(linkFor(line, links, stocked));
  assert.equal(missing("2 onions"), false);
  assert.equal(missing("1 cup rice"), true);
  assert.equal(missing("3 eggs"), true);
  assert.equal(missing("1 lime"), true, "not in the pantry at all");
  assert.equal(missing("2 cups water", { [linkKey("2 cups water")]: "" }), false, "marked not a pantry item");
});

test("missing from the pantry: packets that are short count, and ones that cover it don't (unless marked Low)", () => {
  const stocked = [item("onion", "Onion"), { id: "eggs", name: "Eggs", status: "low" } as never];
  const enough = { kind: "enough", have: "1 kg" } as const;
  const short = { kind: "short", have: "200 g", still: 0.5 } as const;
  assert.equal(missingFromPantry(linkFor("2 onions", null, stocked), short), true, "Have, but short");
  assert.equal(missingFromPantry(linkFor("2 onions", null, stocked), enough), false);
  assert.equal(missingFromPantry(linkFor("3 eggs", null, stocked), enough), true, "marked Low");
  assert.equal(missingFromPantry(linkFor("2 cups water", { [linkKey("2 cups water")]: "" }, stocked), short), false, "water never");
});

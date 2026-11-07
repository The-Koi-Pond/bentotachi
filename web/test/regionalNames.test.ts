// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { otherNames, searchVariants, withRegionalHint } from "../src/regionalNames.ts";
import { guessPantryItem } from "../src/pantryLinks.ts";
import { matchesSearch, searchWords } from "../src/recipeSearch.ts";
import { foldText } from "../src/wordMatch.ts";

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
  assert.equal(withRegionalHint("1 can garbanzo beans", "AU"), "1 can garbanzo beans *(chickpeas)*");
  assert.equal(withRegionalHint("1 red bell pepper", "OTHER"), "1 red bell pepper");
  // Words that mean different things in different places.
  assert.equal(withRegionalHint("4 shallots, finely sliced", "US"), "4 shallots, finely sliced");
  assert.equal(withRegionalHint("2 tbsp tomato purée", "AU"), "2 tbsp tomato purée");
  assert.equal(withRegionalHint("1 pawpaw, diced", "US"), "1 pawpaw, diced");
  assert.equal(withRegionalHint("1 tsp mixed spice", "US"), "1 tsp mixed spice");
});

test("British words get a hint in both countries", () => {
  assert.equal(withRegionalHint("2 aubergines, cubed", "AU"), "2 aubergines *(eggplants)*, cubed");
  assert.equal(withRegionalHint("1 courgette", "US"), "1 courgette *(zucchini)*");
  assert.equal(withRegionalHint("100 g mangetout", "AU"), "100 g mangetout *(snow peas)*");
  assert.equal(withRegionalHint("½ head Chinese leaf", "AU"), "½ head Chinese leaf *(wombok)*");
  assert.equal(withRegionalHint("½ head Chinese leaf", "US"), "½ head Chinese leaf *(napa cabbage)*");
  assert.equal(withRegionalHint("250 g chestnut mushrooms", "US"), "250 g chestnut mushrooms *(creminis)*");
  assert.equal(withRegionalHint("Cover with cling film", "AU"), "Cover with cling film *(cling wrap)*");
  // Australia says it the British way too.
  assert.equal(withRegionalHint("500 g strong white bread flour", "AU"), "500 g strong white bread flour");
  assert.equal(withRegionalHint("1 eggplant", "AU"), "1 eggplant");
});

test("hints follow the word's plural", () => {
  assert.equal(withRegionalHint("2 bell peppers", "AU"), "2 bell peppers *(capsicums)*");
  assert.equal(withRegionalHint("500 g prawns", "US"), "500 g prawns *(shrimp)*");
  assert.equal(withRegionalHint("1 lb shrimp", "AU"), "1 lb shrimp *(prawns)*");
  assert.equal(withRegionalHint("1 tsp crushed red pepper", "AU"), "1 tsp crushed red pepper *(chilli flakes)*");
  assert.equal(withRegionalHint("2 tbsp nonpareils", "AU"), "2 tbsp nonpareils *(hundreds and thousands)*");
  assert.equal(withRegionalHint("Line with parchment", "AU"), "Line with parchment *(baking paper)*");
});

test("some hints are for one country only", () => {
  assert.equal(withRegionalHint("Cover with alfoil", "US"), "Cover with alfoil *(aluminum foil)*");
  assert.equal(withRegionalHint("Cover with aluminum foil", "AU"), "Cover with aluminum foil");
});

test("spellings link and search alike, without hints", () => {
  const pantry = [item("yog", "Yoghurt"), item("chi", "Chilli"), item("hal", "Haloumi"), item("gel", "Gelatine"), item("pak", "Pak choi")];
  const guess = (line: string) => (guessPantryItem(line, pantry) as { id: string } | null)?.id ?? null;
  assert.equal(guess("1 cup Greek yogurt"), "yog");
  assert.equal(guess("2 red chilies, sliced"), "chi");
  assert.equal(guess("1 tsp chili powder"), null);
  assert.equal(guess("200 g halloumi"), "hal");
  assert.equal(guess("2 tsp powdered gelatin"), "gel");
  assert.equal(guess("2 heads bok choy"), "pak");
  assert.ok(searchVariants("yoghurt").some((words) => words.join(" ") === "yogurt"));
  assert.equal(withRegionalHint("1 cup yogurt", "AU"), "1 cup yogurt");
});

test("new pairs link both ways", () => {
  const pantry = [item("swb", "Swiss browns"), item("wom", "Wombok"), item("bp", "Baking paper"), item("eng", "English spinach"), item("spi", "Spinach")];
  const guess = (line: string) => (guessPantryItem(line, pantry) as { id: string } | null)?.id ?? null;
  assert.equal(guess("8 oz cremini mushrooms"), "swb");
  assert.equal(guess("250 g chestnut mushrooms"), "swb");
  assert.equal(guess("½ napa cabbage"), "wom");
  assert.equal(guess("Line a tray with parchment paper"), "bp");
  // English spinach is spinach, but plain spinach may be silverbeet.
  assert.equal(guessPantryItem("2 cups baby spinach", [item("eng", "English spinach")])?.["id" as never], "eng");
  assert.equal(guessPantryItem("1 bunch English spinach", [item("spi", "Spinach")])?.["id" as never], "spi");
});

test("accents and hyphens don't count", () => {
  const pantry = [item("jal", "Jalapeno"), item("srf", "Self raising flour"), item("cf", "Crème fraîche")];
  const guess = (line: string) => (guessPantryItem(line, pantry) as { id: string } | null)?.id ?? null;
  assert.equal(guess("2 jalapeños, sliced"), "jal");
  assert.equal(guess("2 cups self-raising flour"), "srf");
  assert.equal(guess("2 tbsp creme fraiche"), "cf");
  // The hint lands right after the word, accents and all.
  assert.equal(withRegionalHint("1 cup self-rising flour", "AU"), "1 cup self-rising flour *(self-raising flour)*");
  assert.equal(withRegionalHint("100 g glace cherries", "US"), "100 g glace cherries *(candied cherries)*");
  assert.equal(foldText("Crème-fraîche"), "creme fraiche");
  const recipe = { title: "Jalapeño poppers", tags: ["stir-fry"], ingredients: ["1 cup self-raising flour"] };
  assert.equal(matchesSearch(recipe, searchWords("jalapeno")), true);
  assert.equal(matchesSearch(recipe, searchWords("stir fry")), true);
  assert.equal(matchesSearch(recipe, searchWords("self rising flour")), true);
});

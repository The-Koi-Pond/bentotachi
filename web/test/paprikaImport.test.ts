// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync, strToU8, zipSync } from "fflate";
import {
  IMPORT_LIMITS,
  alreadyHave,
  fitImported,
  fromPaprika,
  paprikaEntries,
  paprikaPhoto,
  paprikaRating,
  readPaprikaFile,
  someNames,
  toMinutes,
} from "../src/paprikaImport.ts";
import { paprikaFile, paprikaUid, toPaprika } from "../src/paprikaExport.ts";

// A 1×1 PNG.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const paprika = {
  uid: "A1",
  name: "Lemon tart",
  description: "Sharp and buttery.",
  ingredients: "For the pastry:\n200 g flour\n100 g butter\n\nFor the filling:\n4 lemons\nSalt: a pinch",
  directions: "Make the pastry.\n\nBake blind for 15 minutes.\nFill and bake.",
  notes: "Freezes well.",
  servings: "8",
  prep_time: "30 mins",
  cook_time: "1 hr 10 min",
  total_time: "",
  source_url: "https://www.example.com/tart",
  categories: ["Dessert", "Baking", "dessert"],
  photo_data: PNG,
  rating: 4,
};

test("a Paprika recipe in Bento's shape", () => {
  const recipe = fromPaprika(paprika);
  assert.equal(recipe.title, "Lemon tart");
  assert.equal(recipe.servings, "8");
  assert.equal(recipe.prep_minutes, 30);
  assert.equal(recipe.cook_minutes, 70);
  assert.equal(recipe.total_minutes, 0);
  assert.deepEqual(recipe.ingredients, ["# For the pastry", "200 g flour", "100 g butter", "# For the filling", "4 lemons", "Salt: a pinch"]);
  assert.deepEqual(recipe.steps, ["Make the pastry.", "Bake blind for 15 minutes.", "Fill and bake."]);
  assert.deepEqual(recipe.tags, ["dessert", "baking"]);
  assert.equal(recipe.notes, "Freezes well.");
  assert.equal(recipe.photo?.type, "image/png");
});

test("what Bentotachi has no place for goes into the notes, not lost", () => {
  const recipe = fromPaprika({
    ...paprika,
    source: "Ottolenghi Simple, p. 42",
    source_url: "",
    difficulty: "Easy",
    nutritional_info: "Calories: 420\nProtein: 12 g",
  });
  assert.equal(recipe.notes, "Freezes well.\n\nSource: Ottolenghi Simple, p. 42\nDifficulty: Easy");
  // Nutrition has a place of its own, a line each (blank lines left out).
  assert.deepEqual(recipe.nutrition, ["Calories: 420", "Protein: 12 g"]);
  assert.deepEqual(fromPaprika({ ...paprika, nutritional_info: "Calories: 420\r\n\n  Protein: 12 g\n" }).nutrition, ["Calories: 420", "Protein: 12 g"]);
  // A source that's only the link's site adds nothing (the card shows it).
  assert.equal(fromPaprika({ ...paprika, source: "example.com" }).notes, "Freezes well.");
  // Written in the link box instead, it's kept too.
  assert.equal(fromPaprika({ ...paprika, notes: "", source_url: "Nan's recipe card" }).notes, "Source: Nan's recipe card");
});

test("the person's own rating and favorite, for their onigiri and heart", () => {
  assert.deepEqual(paprikaRating(paprika), { stars: 4, favorite: false });
  assert.deepEqual(paprikaRating({ rating: 0, on_favorites: true }), { stars: 0, favorite: true });
  assert.deepEqual(paprikaRating({ rating: "5", on_favorites: 1 }), { stars: 5, favorite: true });
  assert.deepEqual(paprikaRating({ rating: 9 }), { stars: 5, favorite: false });
  assert.equal(paprikaRating({ rating: 0, on_favorites: false }), null);
  assert.equal(paprikaRating({ rating: "lots" }), null);
  // "0" and "false" aren't favorites.
  assert.equal(paprikaRating({ on_favorites: "0" }), null);
  assert.equal(paprikaRating({ on_favorites: "false" }), null);
  assert.equal(paprikaRating({}), null);
});

test("times as Paprika apps write them", () => {
  assert.equal(toMinutes("15 mins"), 15);
  assert.equal(toMinutes("1 hour"), 60);
  assert.equal(toMinutes("1 hr 30 min"), 90);
  assert.equal(toMinutes(""), 0);
  assert.equal(toMinutes(undefined), 0);
});

test("a whole file, zipped or single", () => {
  const entry = gzipSync(strToU8(JSON.stringify(paprika)));
  const zipped = zipSync({ "Lemon tart.paprikarecipe": entry, "broken.paprikarecipe": strToU8("not json") }, { level: 0 });
  const read = readPaprikaFile(zipped);
  assert.equal(read.recipes.length, 1);
  assert.equal(read.unreadable, 1);
  assert.equal(readPaprikaFile(entry).recipes[0].name, "Lemon tart");
  assert.equal(readPaprikaFile(strToU8("rubbish")).unreadable, 1);
});

test("Bento's own export comes back as it was", () => {
  const original = {
    id: "r1",
    title: "Pumpkin soup",
    description: "",
    source_url: "https://www.taste.com.au/soup",
    servings: "4",
    prep_minutes: 10,
    cook_minutes: 30,
    total_minutes: 0,
    ingredients: ["# Soup", "1 kg pumpkin", "**2 tbsp** oil"],
    steps: ["Roast.", "Blend."],
    tags: ["soup", "winter"],
    notes: "Double it.",
    author_notes: "Use butternut.",
    nutrition: ["Calories: 210 kcal", "Protein: 4 g"],
    created: "2026-10-31 09:15:00.000Z",
  };
  const file = paprikaFile([toPaprika(original, PNG, 5)]);
  const back = fromPaprika(readPaprikaFile(file).recipes[0]);
  assert.equal(back.title, "Pumpkin soup");
  assert.deepEqual(back.ingredients, ["# Soup", "1 kg pumpkin", "2 tbsp oil"]);
  assert.deepEqual(back.steps, ["Roast.", "Blend."]);
  assert.deepEqual(back.tags, ["soup", "winter"]);
  assert.equal(back.notes, "Double it.");
  assert.equal(back.author_notes, "Use butternut.");
  assert.deepEqual(back.nutrition, ["Calories: 210 kcal", "Protein: 4 g"]);
  assert.equal(back.prep_minutes, 10);
  assert.equal(back.cook_minutes, 30);
  // The export writes the total it showed (40), so it comes back as one.
  assert.equal(back.total_minutes, 40);
  assert.ok(back.photo);
  // The household's rating and the exporter's heart come along.
  const raw = readPaprikaFile(paprikaFile([toPaprika(original, "", 4.4, true)])).recipes[0];
  assert.deepEqual(paprikaRating(raw), { stars: 4, favorite: true });
  // Without a link, nothing is added to the notes either.
  const homemade = readPaprikaFile(paprikaFile([toPaprika({ ...original, source_url: "" }, "", 0)])).recipes[0];
  assert.equal(fromPaprika(homemade).notes, "Double it.");
});

test("recipes we already have are skipped: the same name, and the same link or ingredients", () => {
  const tart = fromPaprika(paprika);
  // Same name and link.
  assert.equal(alreadyHave(tart, [{ title: "lemon tart", source_url: "https://www.example.com/tart", ingredients: [] }]), true);
  // Same name and ingredients (capitals and spaces aside), no link here.
  assert.equal(alreadyHave(tart, [{ title: "Lemon tart", source_url: "", ingredients: tart.ingredients.map((l) => ` ${l.toUpperCase()}`) }]), true);
  // Same name, but different ingredients and no matching link: a different
  // recipe, so it comes in (it used to be skipped when either had no link).
  assert.equal(alreadyHave(tart, [{ title: "Lemon tart", source_url: "", ingredients: ["1 lemon"] }]), false);
  assert.equal(alreadyHave(tart, [{ title: "Lemon tart", source_url: "https://other.example.com/tart", ingredients: ["1 lemon"] }]), false);
  assert.equal(alreadyHave(tart, [{ title: "Lime tart", ingredients: tart.ingredients }]), false);
  // Two different recipes of the same name, neither with a link, both come in.
  const pancakes = { title: "Pancakes", source_url: "", ingredients: ["2 eggs"] };
  assert.equal(alreadyHave(pancakes, [{ title: "Pancakes", source_url: "", ingredients: ["1 banana"] }]), false);
});

test("Bentotachi's own export comes back as already here, however the export reworded it", () => {
  const original = {
    id: "rec123",
    title: "Pancakes",
    description: "",
    source_url: "",
    servings: "",
    prep_minutes: 0,
    cook_minutes: 0,
    total_minutes: 0,
    // Formatting marks, a heading with a digit, a ## heading and a line
    // ending in a colon: all changed by the export.
    ingredients: ["2 eggs *or 3 if small*", "# Day 1", "## For the glaze", "Salt to taste:"],
    steps: ["Mix."],
    tags: [],
    notes: "",
    author_notes: "",
    created: "",
  };
  const raw = readPaprikaFile(paprikaFile([toPaprika(original, "", 0)])).recipes[0];
  const back = fromPaprika(raw);
  assert.notDeepEqual(back.ingredients, original.ingredients);
  assert.equal(alreadyHave(back, [original]), true);
  // Its uid is the recipe's id here, enough on its own (renamed since).
  assert.equal(alreadyHave(back, [{ ...original, title: "Renamed", ingredients: [] }], String(raw.uid)), true);
  assert.equal(alreadyHave(back, [{ ...original, id: "other", title: "Renamed" }], String(raw.uid)), false);
  // A real 15-character id comes back from its UUID too, and so does a
  // file from before uids were UUIDs (the plain id).
  const real = { ...original, id: "h5hx6eedrsxetc0", title: "Renamed", ingredients: [] };
  assert.equal(alreadyHave(back, [real], paprikaUid("h5hx6eedrsxetc0")), true);
  assert.equal(alreadyHave(back, [real], paprikaUid("h5hx6eedrsxetc1")), false);
  assert.equal(alreadyHave(back, [real], "h5hx6eedrsxetc0"), true);
  assert.equal(alreadyHave(back, [{ ...real, id: "0abcdefghijklmn" }], paprikaUid("0abcdefghijklmn")), true);
  // Paprika's own uids never match a recipe here.
  assert.equal(alreadyHave(back, [real], "8F5A2D3C-1B2E-4C6D-9A0B-7E3F5D1C2B4A"), false);
});

test("a file's recipes come one at a time, in order", () => {
  const recipe = (name: string) => gzipSync(strToU8(JSON.stringify({ ...paprika, name })));
  const zipped = zipSync({ "a.paprikarecipe": recipe("A"), "b.paprikarecipe": strToU8("not json"), "c.paprikarecipe": recipe("C") }, { level: 0 });
  const entries = paprikaEntries(zipped);
  assert.equal(entries.count, 3);
  assert.deepEqual([...entries.recipes()].map((r) => r?.name ?? null), ["A", null, "C"]);
  // A single recipe, and nothing at all.
  assert.deepEqual([...paprikaEntries(recipe("Solo")).recipes()].map((r) => r?.name), ["Solo"]);
  assert.equal(paprikaEntries(new Uint8Array(0)).count, 0);
  assert.deepEqual([...paprikaEntries(new Uint8Array(0)).recipes()], []);
});

test("many entries come in order across several batches", () => {
  const recipe = (name: string) => gzipSync(strToU8(JSON.stringify({ ...paprika, name })));
  // Big entries (like photos) make several few-MB batches; order is kept.
  const names = Array.from({ length: 40 }, (_, i) => `R${i}`);
  const filler = new Uint8Array(3 * 1024 * 1024).map((_, i) => (i * 7919) % 251);
  const files: Record<string, Uint8Array> = {};
  names.forEach((name, i) => {
    files[`${name}.paprikarecipe`] = recipe(name);
    if (i % 10 === 5) files[`filler-${i}`] = filler;
  });
  const read = [...paprikaEntries(zipSync(files, { level: 0 })).recipes()];
  assert.equal(read.length, 44);
  assert.deepEqual(read.filter(Boolean).map((r) => r?.name), names);
});

test("two entries of the same name both come in", () => {
  // Some exporters might write two entries with one name; entries come back
  // keyed by name, so the batch reader must not let one hide the other.
  const entry = (name: string) => gzipSync(strToU8(JSON.stringify({ name })));
  const zipped = zipSync({ "Soup1.paprikarecipe": entry("Soup A"), "Soup2.paprikarecipe": entry("Soup B") }, { level: 0 });
  // Rename "Soup2" to "Soup1" in its local header and directory entry.
  const target = strToU8("Soup2.paprikarecipe");
  for (let i = 0; i + target.length <= zipped.length; i++) {
    if (target.every((b, k) => zipped[i + k] === b)) zipped[i + 4] = 0x31;
  }
  assert.deepEqual([...paprikaEntries(zipped).recipes()].map((r) => r?.name ?? null), ["Soup A", "Soup B"]);
});

test("the import's photo, decoded later, is the whole photo", () => {
  // The import screen converts without the photo, then decodes it only for
  // recipes it adds (paprikaPhoto).
  assert.equal(fromPaprika(paprika, { withPhoto: false }).photo, null);
  const photo = paprikaPhoto(paprika);
  assert.equal(photo?.type, "image/png");
  assert.deepEqual(photo?.bytes, new Uint8Array(Buffer.from(PNG, "base64")));
  assert.equal(paprikaPhoto({ name: "No photo" }), null);
});

test("one damaged entry is unreadable, not the end of the import", () => {
  const good = gzipSync(strToU8(JSON.stringify({ name: "A" })));
  const later = gzipSync(strToU8(JSON.stringify({ name: "C" })));
  const zipped = zipSync(
    { "a.paprikarecipe": good, "b.paprikarecipe": [strToU8("x".repeat(500)), { level: 6 }], "c.paprikarecipe": later },
    { level: 0 }
  );
  // Entry b's compressed data starts with a block type that doesn't exist.
  const second = zipped.indexOf(0x50, 30 + 15 + good.length);
  zipped[second + 30 + 15] = 0x07;
  assert.deepEqual([...paprikaEntries(zipped).recipes()].map((r) => r?.name ?? null), ["A", null, "C"]);
});

test("an over-long recipe is cut to what the database keeps, not refused", () => {
  const long = fitImported({
    ...fromPaprika(paprika),
    title: "T".repeat(400),
    description: "Story. ".repeat(1000),
    ingredients: Array.from({ length: 20000 }, (_, i) => `${i} g item`),
    notes: "🍜".repeat(20005),
  });
  assert.equal([...long.title].length, 300);
  assert.ok(long.title.endsWith("…"));
  assert.ok([...long.description].length <= 5000);
  assert.ok(new TextEncoder().encode(JSON.stringify(long.ingredients)).length <= 200000);
  assert.equal(long.ingredients[0], "0 g item");
  // Emoji count as one character each, as the database counts them.
  assert.equal([...long.notes].length, 20000);
  // A normal recipe is left as it is.
  const tart = fromPaprika(paprika);
  const { photo, ...plain } = tart;
  assert.deepEqual(fitImported(plain), plain);
  assert.ok(photo);
});

test("every text field and list is cut to fit, by the database's own measure", () => {
  const long = fitImported({
    ...fromPaprika({ name: "x" }),
    servings: "s".repeat(200),
    author_notes: "a".repeat(20005),
    steps: Array.from({ length: 20000 }, (_, i) => `Step ${i}`),
    ingredients: Array.from({ length: 20000 }, () => "ラーメン 1 杯"),
    tags: Array.from({ length: 5000 }, (_, i) => `tag${i}`),
  });
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
  assert.equal([...long.servings].length, 100);
  assert.equal([...long.author_notes].length, 20000);
  assert.ok(bytes(long.steps) <= 200000 && long.steps.length > 1000);
  // Lists are measured in bytes, so Japanese lines take their full size.
  assert.ok(bytes(long.ingredients) <= 200000 && bytes(long.ingredients) > 190000);
  assert.ok(bytes(long.tags) <= 20000 && bytes(long.tags) > 19000);
  // Exactly at the limit is kept whole, an emoji counting as one.
  assert.equal(fitImported({ ...long, title: "🍜".repeat(300) }).title, "🍜".repeat(300));
});

test("the import's limits are the server's", async () => {
  const { createRequire } = await import("node:module");
  const server = createRequire(import.meta.url)("../../server/pb_hooks/recipe_parse.js").LIMITS;
  assert.deepEqual(IMPORT_LIMITS, {
    title: server.title,
    description: server.description,
    servings: server.servings,
    notes: server.authorNotes,
    listBytes: server.listBytes,
    tagBytes: server.tagBytes,
  });
});

test("messages name up to five recipes, kept short", () => {
  assert.equal(someNames([]), "");
  assert.equal(someNames(["Soup"]), "“Soup”");
  assert.equal(someNames(["Soup", "Tart"]), "“Soup” and “Tart”");
  assert.equal(someNames(["A", "B", "C"]), "“A”, “B” and “C”");
  assert.equal(someNames(["A", "B", "C", "D", "E"]), "“A”, “B”, “C”, “D” and “E”");
  assert.equal(someNames(["A", "B", "C", "D", "E", "F", "G"]), "“A”, “B”, “C”, “D” and 3 more");
  assert.equal(someNames(["x".repeat(80)]), `“${"x".repeat(49)}…”`);
});

test("odd values don't break it", () => {
  const recipe = fromPaprika({ name: "  ", ingredients: null, directions: 42, categories: "x", source_url: "javascript:alert(1)" });
  assert.equal(recipe.title, "Untitled recipe");
  assert.deepEqual(recipe.ingredients, []);
  assert.deepEqual(recipe.steps, []);
  assert.deepEqual(recipe.tags, []);
  assert.equal(recipe.source_url, "");
  assert.equal(recipe.photo, null);
});

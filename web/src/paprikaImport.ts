// Recipes from a Paprika file (.paprikarecipes, or one .paprikarecipe), the
// way recipe apps swap recipes: Paprika, Mealie, Tandoor and Bento itself
// (paprikaExport.ts) write them. The reverse of the export: "Sauce:" lines
// become "# Sauce" headings, times like "1 hr 30 min" become minutes,
// categories become tags, and the notes Bento's export joined ("From the
// recipe's writer:") come apart again. Tested in web/test/paprikaImport.test.ts.

import { gunzipSync, strFromU8, unzipSync } from "fflate";
import { stepTimes } from "./stepTimers.ts";
import { textToTags } from "./format.ts";
import { withoutSoftMarks } from "./softMarks.ts";

// What Bento keeps from each recipe (the same fields as a Bento recipe).
export interface ImportedRecipe {
  title: string;
  description: string;
  source_url: string;
  servings: string;
  prep_minutes: number;
  cook_minutes: number;
  total_minutes: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
  notes: string;
  author_notes: string;
  // Nutrition facts, a line each ("Calories: 420 kcal").
  nutrition: string[];
  // The photo's bytes and type, if the file has one.
  photo: { bytes: Uint8Array; type: string } | null;
}

const GZIP = (bytes: Uint8Array) => bytes[0] === 0x1f && bytes[1] === 0x8b;
const ZIP = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

// One entry's raw recipe (gzipped JSON, or plain JSON), or null when it
// isn't one.
function recipeIn(blob: Uint8Array | undefined): Record<string, unknown> | null {
  if (!blob) return null;
  try {
    const json = JSON.parse(strFromU8(GZIP(blob) ? gunzipSync(blob) : blob));
    return json && typeof json === "object" && typeof json.name === "string" ? json : null;
  } catch {
    return null;
  }
}

// Entries of index i in [from, to) of a zip, unpacked in one pass and
// returned in order (undefined for one that can't be unpacked). Several in
// one pass because each pass reads the zip's whole directory; one entry per
// pass made a 3000-recipe file 9 million directory reads.
function unpackRange(bytes: Uint8Array, names: string[], from: number, to: number): (Uint8Array | undefined)[] {
  const unpackOne = (i: number) => {
    let at = -1;
    try {
      return Object.values(unzipSync(bytes, { filter: () => ++at === i }))[0];
    } catch {
      // Damaged, or packed in a way fflate can't read: just this one.
      return undefined;
    }
  };
  const wanted = names.slice(from, to);
  // Entries come back keyed by name, so a name used twice in the range
  // can't be told apart: one at a time then.
  if (new Set(wanted).size === wanted.length) {
    try {
      let at = -1;
      const found = unzipSync(bytes, {
        filter: () => {
          at += 1;
          return at >= from && at < to;
        },
      });
      return wanted.map((name) => found[name]);
    } catch {
      // One of them is damaged: find which, one at a time.
    }
  }
  return wanted.map((_, n) => unpackOne(from + n));
}

// About this many bytes of entries unpacked per pass: few passes, but never
// much of the file in memory at once.
const BATCH_BYTES = 8 * 1024 * 1024;

// A file's recipes, unpacked a few MB at a time: how many entries it has,
// and each entry's raw recipe in turn (null when it can't be read, so one
// damaged entry doesn't end the import). A .paprikarecipes file is a zip
// of gzipped JSON; a single .paprikarecipe is one gzipped JSON. Never all
// at once: a big collection's photos make the file hundreds of MB, and
// unpacking it whole took 4-5 times that in memory, enough for Android to
// close the app on many phones (stress test, 2026-11-07).
export function paprikaEntries(bytes: Uint8Array): { count: number; recipes: () => Generator<Record<string, unknown> | null> } {
  if (!ZIP(bytes)) {
    return {
      count: bytes.length ? 1 : 0,
      recipes: function* () {
        if (bytes.length) yield recipeIn(bytes);
      },
    };
  }
  // Listing the entries unpacks nothing (the filter says no to each).
  const names: string[] = [];
  const sizes: number[] = [];
  unzipSync(bytes, {
    filter: (file) => {
      names.push(file.name);
      sizes.push(file.size);
      return false;
    },
  });
  return {
    count: names.length,
    recipes: function* () {
      let from = 0;
      while (from < names.length) {
        let to = from + 1;
        let batch = sizes[from];
        while (to < names.length && batch + sizes[to] <= BATCH_BYTES) batch += sizes[to++];
        for (const blob of unpackRange(bytes, names, from, to)) yield recipeIn(blob);
        from = to;
      }
    },
  };
}

// The recipes' raw JSON objects in a file, and how many entries couldn't be
// read, all at once (for small files and the tests; the import screen goes
// through them one at a time with paprikaEntries).
export function readPaprikaFile(bytes: Uint8Array): { recipes: Record<string, unknown>[]; unreadable: number } {
  const recipes: Record<string, unknown>[] = [];
  let unreadable = 0;
  for (const recipe of paprikaEntries(bytes).recipes()) {
    if (recipe) recipes.push(recipe);
    else unreadable += 1;
  }
  if (!recipes.length && !unreadable) unreadable = 1;
  return { recipes, unreadable };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// "1 hr 30 min", "15 mins", "1 hour" -> minutes; 0 when it doesn't say.
export function toMinutes(value: unknown): number {
  const time = stepTimes(text(value))[0];
  return time ? Math.round(time.seconds / 60) : 0;
}

// A line on its own that ends in a colon ("For the sauce:") is a heading,
// as Paprika writes them; one with an amount in it ("Salt: 1 tsp") isn't.
function asLines(value: unknown): string[] {
  return text(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/^[^\d]{1,60}:$/.test(line) ? `# ${line.slice(0, -1).trim()}` : line));
}

// Bento's export put the recipe writer's notes after its own, under "From the
// recipe's writer:"; any app's other notes stay as notes.
function splitNotes(notes: string): { notes: string; author_notes: string } {
  const marker = "From the recipe's writer:";
  const at = notes.indexOf(marker);
  if (at < 0) return { notes, author_notes: "" };
  return { notes: notes.slice(0, at).trim(), author_notes: notes.slice(at + marker.length).trim() };
}

// The photo's type from its first bytes (JPEG, PNG, WebP, GIF), or null.
function photoType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

// A raw recipe's photo, decoded (it's the slow part of reading a recipe,
// so the import only does it for recipes it's going to add).
export function paprikaPhoto(raw: Record<string, unknown>): ImportedRecipe["photo"] {
  return photoOf(raw.photo_data);
}

function photoOf(value: unknown): ImportedRecipe["photo"] {
  const data = text(value);
  if (!data) return null;
  try {
    const binary = atob(data.replace(/^data:[^,]*,/, ""));
    // A plain loop: several times faster than Uint8Array.from with a
    // function, which made photos most of a big import's time.
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const type = photoType(bytes);
    return type ? { bytes, type } : null;
  } catch {
    return null;
  }
}

// What Paprika keeps that Bentotachi has no place for, kept in the notes
// rather than lost (Xel, 2026-11-07): where it's from when that isn't a
// link (a cookbook, "Grandma's card") and the difficulty. Bentotachi's own
// export leaves these empty (its source is the link's site), so nothing is
// added coming back. (Nutrition has its own place: `nutrition`.)
function paprikaExtras(raw: Record<string, unknown>): string {
  const link = text(raw.source_url);
  const source = text(raw.source) || (/^https?:\/\//i.test(link) ? "" : link);
  const difficulty = text(raw.difficulty);
  return [!/^https?:\/\//i.test(link) && source && `Source: ${source}`, difficulty && `Difficulty: ${difficulty}`]
    .filter(Boolean)
    .join("\n");
}

// The person's own rating in Paprika (0 to 5 stars; 0 is none) and whether
// it's on their favorites, which the import makes the importing person's
// onigiri and heart. Null when there's neither.
export function paprikaRating(raw: Record<string, unknown>): { stars: number; favorite: boolean } | null {
  const rating = Number(raw.rating);
  const stars = Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
  const favorite = raw.on_favorites === true || raw.on_favorites === 1 || raw.on_favorites === "1" || raw.on_favorites === "true";
  return stars || favorite ? { stars, favorite } : null;
}

// `withPhoto: false` leaves the photo for later (paprikaPhoto).
export function fromPaprika(raw: Record<string, unknown>, { withPhoto = true } = {}): ImportedRecipe {
  const split = splitNotes(text(raw.notes));
  const extras = paprikaExtras(raw);
  const notes = [split.notes, extras].filter(Boolean).join("\n\n");
  const author_notes = split.author_notes;
  // Lowercase, like tags typed in Bento (textToTags).
  const tags = Array.isArray(raw.categories) ? textToTags(raw.categories.map(text).join(",")) : [];
  return {
    title: text(raw.name) || "Untitled recipe",
    description: text(raw.description),
    source_url: /^https?:\/\//i.test(text(raw.source_url)) ? text(raw.source_url) : "",
    servings: text(raw.servings),
    prep_minutes: toMinutes(raw.prep_time),
    cook_minutes: toMinutes(raw.cook_time),
    total_minutes: toMinutes(raw.total_time),
    ingredients: asLines(raw.ingredients),
    steps: asLines(raw.directions),
    tags,
    notes,
    author_notes,
    // Paprika's is free text: a line each, blank lines left out.
    nutrition: text(raw.nutritional_info)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    photo: withPhoto ? photoOf(raw.photo_data) : null,
  };
}

// Ingredient lines as compared for "already here": formatting marks, a
// heading's #s and a trailing colon left out, as an export and import
// change those ("## For the glaze" comes back "# For the glaze", "# Day 1"
// as "Day 1:", "*soft*" as plain), then capitals and spaces.
function comparable(lines: string[] | null | undefined): string {
  return JSON.stringify(
    (lines ?? [])
      .map((line) =>
        withoutSoftMarks(line)
          .trim()
          .replace(/^#+\s*/, "")
          .replace(/:\s*$/, "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );
}

// The Bentotachi recipe id an export's uid was made from (paprikaUid in
// paprikaExport.ts: the 15-character id as a base-36 number, in hex), or ""
// for Paprika's own uids, which come out far longer than any id here.
// Without leading zeros, as a number has none (compared that way below).
function idFromUid(uid: string): string {
  const hex = uid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) return "";
  const id = BigInt(`0x${hex}`).toString(36);
  return id.length <= 15 ? id : "";
}

// Whether a recipe is already in Bento: Bentotachi's own export of it (its
// `uid` is the recipe's id here, or since 2026-11-07 that id in Paprika's
// UUID shape), or the same name and either the same link
// (both have one) or the same ingredients. So importing the same file twice
// adds nothing, but two different "Pancakes" (one without a link) both come
// in; before 2026-11-07 a missing link counted as a match.
export function alreadyHave(
  recipe: Pick<ImportedRecipe, "title" | "source_url" | "ingredients">,
  existing: { id?: string; title: string; source_url?: string; ingredients?: string[] | null }[],
  uid = ""
): boolean {
  const name = recipe.title.trim().toLowerCase();
  const lines = comparable(recipe.ingredients);
  const ownId = idFromUid(uid);
  return existing.some(
    (other) =>
      (!!uid && (other.id === uid || (!!ownId && other.id?.replace(/^0+/, "") === ownId))) ||
      (other.title.trim().toLowerCase() === name &&
        ((!!recipe.source_url && other.source_url === recipe.source_url) || comparable(other.ingredients) === lines))
  );
}

// What the database keeps (as server/pb_hooks/recipe_parse.js LIMITS and
// the recipes collection's field sizes): longer text is cut, ending in
// "…", and lists keep as many lines as fit, so an over-long recipe still
// comes in instead of failing (stress test, 2026-11-07).
// (A test checks these match the server's.)
export const IMPORT_LIMITS = { title: 300, description: 5000, servings: 100, notes: 20000, listBytes: 200000, tagBytes: 20000 };
const LIMITS = IMPORT_LIMITS;

// Characters as PocketBase counts them: an emoji is one.
function fitText(text: string, max: number): string {
  const characters = [...text];
  return characters.length <= max ? text : `${characters.slice(0, max - 1).join("").trimEnd()}…`;
}

function fitLines(lines: string[], maxBytes: number): string[] {
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes(lines) <= maxBytes) return lines;
  const kept: string[] = [];
  let size = 2;
  for (const line of lines) {
    const add = bytes(line) + 1;
    if (size + add > maxBytes) break;
    kept.push(line);
    size += add;
  }
  return kept;
}

export function fitImported<R extends Omit<ImportedRecipe, "photo">>(recipe: R): R {
  return {
    ...recipe,
    title: fitText(recipe.title, LIMITS.title),
    description: fitText(recipe.description, LIMITS.description),
    servings: fitText(recipe.servings, LIMITS.servings),
    notes: fitText(recipe.notes, LIMITS.notes),
    author_notes: fitText(recipe.author_notes, LIMITS.notes),
    ingredients: fitLines(recipe.ingredients, LIMITS.listBytes),
    steps: fitLines(recipe.steps, LIMITS.listBytes),
    tags: fitLines(recipe.tags, LIMITS.tagBytes),
    // Its field keeps the same as tags (migration recipes_nutrition).
    nutrition: fitLines(recipe.nutrition, LIMITS.tagBytes),
  };
}

// Up to five names for a message, each kept short: "“Soup”, “Tart” and 3
// more".
export function someNames(names: string[]): string {
  const shown = names.slice(0, names.length > 5 ? 4 : 5).map((name) => `“${fitText(name, 50)}”`);
  if (names.length > 5) return `${shown.join(", ")} and ${names.length - 4} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : (shown[0] ?? "");
}

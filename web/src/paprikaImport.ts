// Recipes from a Paprika file (.paprikarecipes, or one .paprikarecipe), the
// way recipe apps swap recipes: Paprika, Mealie, Tandoor and Bento itself
// (paprikaExport.ts) write them. The reverse of the export: "Sauce:" lines
// become "# Sauce" headings, times like "1 hr 30 min" become minutes,
// categories become tags, and the notes Bento's export joined ("From the
// recipe's writer:") come apart again. Tested in web/test/paprikaImport.test.ts.

import { gunzipSync, strFromU8, unzipSync } from "fflate";
import { stepTimes } from "./stepTimers.ts";
import { textToTags } from "./format.ts";

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
  // The photo's bytes and type, if the file has one.
  photo: { bytes: Uint8Array; type: string } | null;
}

const GZIP = (bytes: Uint8Array) => bytes[0] === 0x1f && bytes[1] === 0x8b;
const ZIP = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

// The recipes' raw JSON objects in a file, and how many entries couldn't be
// read. A .paprikarecipes file is a zip of gzipped JSON; a single
// .paprikarecipe is one gzipped JSON.
export function readPaprikaFile(bytes: Uint8Array): { recipes: Record<string, unknown>[]; unreadable: number } {
  const blobs = ZIP(bytes) ? Object.values(unzipSync(bytes)) : [bytes];
  const recipes: Record<string, unknown>[] = [];
  let unreadable = 0;
  for (const blob of blobs) {
    try {
      const json = JSON.parse(strFromU8(GZIP(blob) ? gunzipSync(blob) : blob));
      if (json && typeof json === "object" && typeof json.name === "string") recipes.push(json);
      else unreadable += 1;
    } catch {
      unreadable += 1;
    }
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

function photoOf(value: unknown): ImportedRecipe["photo"] {
  const data = text(value);
  if (!data) return null;
  try {
    const binary = atob(data.replace(/^data:[^,]*,/, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const type = photoType(bytes);
    return type ? { bytes, type } : null;
  } catch {
    return null;
  }
}

export function fromPaprika(raw: Record<string, unknown>): ImportedRecipe {
  const { notes, author_notes } = splitNotes(text(raw.notes));
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
    photo: photoOf(raw.photo_data),
  };
}

// Whether a recipe is already in Bento: the same name, and the same link
// when both have one. So importing the same file twice adds nothing.
export function alreadyHave(recipe: ImportedRecipe, existing: { title: string; source_url?: string }[]): boolean {
  const name = recipe.title.trim().toLowerCase();
  return existing.some(
    (other) =>
      other.title.trim().toLowerCase() === name &&
      (!recipe.source_url || !other.source_url || other.source_url === recipe.source_url)
  );
}

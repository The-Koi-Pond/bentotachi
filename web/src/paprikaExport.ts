// Recipes as a Paprika file (.paprikarecipes), the format recipe apps swap
// recipes in: Paprika imports it, and so do Mealie and Tandoor. So people
// can take their recipes anywhere.
//
// The file is a zip with one entry per recipe, "<name>.paprikarecipe",
// each a gzip-compressed JSON object. Fields as Paprika writes them (and
// as Mealie's and Tandoor's importers read them, checked 2026-10-31);
// Tandoor needs every text field present, so empty ones are "" rather
// than left out. Tested in web/test/paprikaExport.test.ts.

import { gzipSync, strToU8, zipSync } from "fflate";
import { extraTimes, formatMinutes, headingOf, totalMinutes } from "./format.ts";
import { withoutSoftMarks } from "./softMarks.ts";

// What the export needs from a recipe (a Bento recipe has all of these).
export interface ExportRecipe {
  id: string;
  title: string;
  description: string;
  source_url: string;
  servings: string;
  prep_minutes: number;
  cook_minutes: number;
  total_minutes: number;
  extra_times?: unknown;
  ingredients: string[] | null;
  steps: string[] | null;
  tags: string[] | null;
  notes: string;
  author_notes: string;
  created: string;
}

export interface PaprikaRecipe {
  uid: string;
  name: string;
  description: string;
  ingredients: string;
  directions: string;
  notes: string;
  nutritional_info: string;
  servings: string;
  prep_time: string;
  cook_time: string;
  total_time: string;
  difficulty: string;
  source: string;
  source_url: string;
  image_url: string;
  photo: string;
  photo_data: string;
  photo_hash: string;
  categories: string[];
  rating: number;
  created: string;
  hash: string;
}

const plain = (text: string) => withoutSoftMarks(text ?? "").trim();
// "1 hr 30 min", as on the recipe page.
const minutes = (n: number) => formatMinutes(n > 0 ? n : 0);

// "https://www.recipetineats.com/x" -> "recipetineats.com".
function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Bento's "# Sauce" headings are Paprika's "Sauce:" (a line ending in a colon).
function lines(list: string[] | null, separator: string): string {
  return (list ?? [])
    .map((line) => {
      const heading = headingOf(line);
      return heading === null ? plain(line) : `${plain(heading)}:`;
    })
    .filter(Boolean)
    .join(separator);
}

// A recipe in Paprika's shape. photo: the photo as base64 JPEG/PNG/WebP, or
// "". rating: 0 to 5 stars (the household's average, rounded).
export function toPaprika(recipe: ExportRecipe, photo: string, rating: number): PaprikaRecipe {
  // Paprika has no place for times like "Cool: 7 hr", so they go in the notes.
  const extras = extraTimes(recipe).map((time) => `${time.label}: ${formatMinutes(time.minutes)}`);
  const notes = [
    plain(recipe.notes),
    recipe.author_notes ? `From the recipe's writer:\n${plain(recipe.author_notes)}` : "",
    extras.length ? `Other times: ${extras.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    uid: recipe.id,
    name: plain(recipe.title) || "Untitled recipe",
    description: plain(recipe.description),
    ingredients: lines(recipe.ingredients, "\n"),
    // A blank line between steps: Mealie splits steps there.
    directions: lines(recipe.steps, "\n\n"),
    notes,
    nutritional_info: "",
    servings: recipe.servings ?? "",
    prep_time: minutes(recipe.prep_minutes),
    cook_time: minutes(recipe.cook_minutes),
    // Prep + cook + other times when there's no total, as Bento shows it.
    total_time: minutes(totalMinutes(recipe)),
    difficulty: "",
    source: siteName(recipe.source_url ?? ""),
    source_url: recipe.source_url ?? "",
    image_url: "",
    photo: photo ? `${recipe.id}.jpg` : "",
    photo_data: photo,
    photo_hash: "",
    categories: recipe.tags ?? [],
    rating: Math.max(0, Math.min(5, Math.round(rating))),
    // Paprika's "2026-10-31 09:15:00".
    created: (recipe.created ?? "").slice(0, 19),
    hash: "",
  };
}

// A file name inside the zip: the recipe's name without characters file
// systems refuse, made unique.
function entryName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").trim().slice(0, 80) || "Recipe";
  let candidate = `${base}.paprikarecipe`;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n}).paprikarecipe`;
  used.add(candidate.toLowerCase());
  return candidate;
}

// The .paprikarecipes file's bytes.
export function paprikaFile(recipes: PaprikaRecipe[]): Uint8Array {
  const used = new Set<string>();
  const entries: Record<string, Uint8Array> = {};
  for (const recipe of recipes) entries[entryName(recipe.name, used)] = gzipSync(strToU8(JSON.stringify(recipe)));
  // The entries are already compressed, so the zip just stores them.
  return zipSync(entries, { level: 0 });
}

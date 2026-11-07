// Recipes as a Paprika file (.paprikarecipes), the format recipe apps swap
// recipes in: Paprika imports it, and so do Mealie and Tandoor. So people
// can take their recipes anywhere.
//
// The file is a zip with one entry per recipe, "<name>.paprikarecipe",
// each a gzip-compressed JSON object. Fields as Paprika writes them (and
// as Mealie's and Tandoor's importers read them, checked 2026-10-31);
// Tandoor needs every text field present, so empty ones are "" rather
// than left out. Tested in web/test/paprikaExport.test.ts.

import { gzipSync, strToU8 } from "fflate";
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

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const TOO_BIG = "That's more than one Paprika file can hold (65,535 recipes, or 4 GB with photos).";

// A .paprikarecipes file written a recipe at a time, each piece handed to
// `write` as it's made, so a big collection never has to fit in memory at
// once (stress test, 2026-11-07: building it whole took over 1 GB on a
// phone). A plain zip that stores the entries (they're gzipped already),
// each with its size and checksum before its data, as every zip reader
// expects. Not for files over 4 GB (no zip64): a recipe collection's
// photos come nowhere near.
export function paprikaZip(write: (piece: Uint8Array) => void) {
  const used = new Set<string>();
  const central: Uint8Array[] = [];
  let offset = 0;
  let count = 0;
  const put = (piece: Uint8Array) => {
    write(piece);
    offset += piece.length;
  };
  return {
    add(recipe: PaprikaRecipe) {
      const name = strToU8(entryName(recipe.name, used));
      const data = gzipSync(strToU8(JSON.stringify(recipe)));
      // A zip without zip64 can't say more: fail plainly rather than write
      // a file other apps would read wrong.
      if (count >= 0xffff || offset + 30 + name.length + data.length > 0xffffffff) throw new Error(TOO_BIG);
      const crc = crc32(data);
      // Local header: version 2.0, UTF-8 names (flag bit 11), stored.
      const local = new Uint8Array(30 + name.length);
      const l = new DataView(local.buffer);
      l.setUint32(0, 0x04034b50, true);
      l.setUint16(4, 20, true);
      l.setUint16(6, 0x0800, true);
      l.setUint16(8, 0, true);
      l.setUint16(12, 0x21, true); // 1 Jan 1980, the earliest a zip can say
      l.setUint32(14, crc, true);
      l.setUint32(18, data.length, true);
      l.setUint32(22, data.length, true);
      l.setUint16(26, name.length, true);
      local.set(name, 30);
      // Its line in the central directory, written at the end.
      const entry = new Uint8Array(46 + name.length);
      const e = new DataView(entry.buffer);
      e.setUint32(0, 0x02014b50, true);
      e.setUint16(4, 20, true);
      e.setUint16(6, 20, true);
      e.setUint16(8, 0x0800, true);
      e.setUint16(14, 0x21, true);
      e.setUint32(16, crc, true);
      e.setUint32(20, data.length, true);
      e.setUint32(24, data.length, true);
      e.setUint16(28, name.length, true);
      e.setUint32(42, offset, true);
      entry.set(name, 46);
      central.push(entry);
      count += 1;
      put(local);
      put(data);
    },
    end() {
      const directory = central.reduce((sum, entry) => sum + entry.length, 0);
      if (offset + directory + 22 > 0xffffffff) throw new Error(TOO_BIG);
      const start = offset;
      for (const entry of central) put(entry);
      const tail = new Uint8Array(22);
      const t = new DataView(tail.buffer);
      t.setUint32(0, 0x06054b50, true);
      t.setUint16(8, count, true);
      t.setUint16(10, count, true);
      t.setUint32(12, offset - start, true);
      t.setUint32(16, start, true);
      put(tail);
    },
  };
}

// The .paprikarecipes file's bytes, all at once (for small exports and the
// tests; the export screen writes as it goes with paprikaZip).
export function paprikaFile(recipes: PaprikaRecipe[]): Uint8Array {
  const pieces: Uint8Array[] = [];
  const zip = paprikaZip((piece) => pieces.push(piece));
  for (const recipe of recipes) zip.add(recipe);
  zip.end();
  const bytes = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
  let at = 0;
  for (const piece of pieces) {
    bytes.set(piece, at);
    at += piece.length;
  }
  return bytes;
}

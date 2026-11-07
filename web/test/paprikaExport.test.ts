// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import { gunzipSync, strFromU8, unzipSync } from "fflate";
import { paprikaFile, paprikaUid, paprikaZip, toPaprika, type ExportRecipe } from "../src/paprikaExport.ts";

const recipe: ExportRecipe = {
  id: "abc123",
  title: "Chicken **chasseur**",
  description: "A French *classic*.",
  source_url: "https://www.recipetineats.com/chicken-chasseur/",
  servings: "4",
  prep_minutes: 15,
  cook_minutes: 40,
  total_minutes: 55,
  ingredients: ["# Chicken", "4 chicken thighs", "# Sauce", "1 cup stock", ""],
  steps: ["Brown the chicken.", "Make the sauce."],
  tags: ["dinner", "french"],
  notes: "Kids loved it.",
  author_notes: "Use thighs, not breast.",
  created: "2026-10-30 09:15:00.000Z",
};

test("a Bento recipe in Paprika's shape", () => {
  const p = toPaprika(recipe, "", 4.4);
  assert.equal(p.name, "Chicken chasseur");
  assert.equal(p.description, "A French classic.");
  assert.equal(p.ingredients, "Chicken:\n4 chicken thighs\nSauce:\n1 cup stock");
  assert.equal(p.directions, "Brown the chicken.\n\nMake the sauce.");
  assert.equal(p.notes, "Kids loved it.\n\nFrom the recipe's writer:\nUse thighs, not breast.");
  assert.equal(p.prep_time, "15 min");
  assert.equal(p.total_time, "55 min");
  const noTotal = toPaprika({ ...recipe, total_minutes: 0, extra_times: [{ label: "Cool", minutes: 420 }] }, "", 0);
  assert.equal(noTotal.total_time, "7 h 55 min");
  assert.match(noTotal.notes, /Other times: Cool: 7 h$/);
  assert.equal(p.source, "recipetineats.com");
  assert.deepEqual(p.categories, ["dinner", "french"]);
  assert.equal(p.rating, 4);
  assert.equal(p.created, "2026-10-30 09:15:00");
  assert.equal(p.photo, "");
});

test("each recipe's uid is a UUID, as Paprika refuses a file otherwise, the same for the same recipe", () => {
  const uuid = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
  const real = paprikaUid("h5hx6eedrsxetc0");
  assert.match(real, uuid);
  assert.equal(paprikaUid("h5hx6eedrsxetc0"), real);
  assert.notEqual(paprikaUid("h5hx6eedrsxetc1"), real);
  // The largest possible id still fits.
  assert.match(paprikaUid("zzzzzzzzzzzzzzz"), uuid);
  assert.equal(toPaprika(recipe, "", 0).uid, paprikaUid("abc123"));
});

test("the file is a zip of gzipped JSON, one per recipe, readable like Mealie and Tandoor do", () => {
  const bytes = paprikaFile([
    toPaprika(recipe, "aGVsbG8=", 0),
    toPaprika({ ...recipe, id: "def456" }, "", 0),
    toPaprika({ ...recipe, id: "ghi789", title: 'Mac/cheese: "best"', prep_minutes: 0 }, "", 0),
  ]);
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  assert.deepEqual(names, ["Chicken chasseur.paprikarecipe", "Chicken chasseur (2).paprikarecipe", "Maccheese best.paprikarecipe"]);
  const first = JSON.parse(strFromU8(gunzipSync(files[names[0]])));
  // Tandoor reads these without a default, so they must all be there.
  for (const key of ["name", "directions", "notes", "nutritional_info", "source", "source_url", "ingredients"])
    assert.equal(typeof first[key], "string", key);
  assert.equal(first.photo_data, "aGVsbG8=");
  assert.equal(first.photo, `${first.uid}.jpg`);
  const third = JSON.parse(strFromU8(gunzipSync(files[names[2]])));
  assert.equal(third.name, 'Mac/cheese: "best"');
  assert.equal(third.prep_time, "");
});

// fflate (above) reads only part of a zip and checks no checksums; Python
// (Mealie, Tandoor), Java and Paprika read more, so this walks the file the
// way strict readers do (review, 2026-11-07: 28 of 50 deliberate breaks to
// the writer passed the test above, and would have broken every export for
// those apps).
test("the zip is what strict readers expect: checksums, sizes, counts, UTF-8 names", () => {
  const titles = ["Plain soup", "Crème brûlée 🍜"];
  const bytes = paprikaFile(titles.map((title, i) => toPaprika({ ...recipe, id: `r${i}`, title }, "", 0)));
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Front to back, as a streaming reader does: each local header must
  // describe its data.
  const offsets: number[] = [];
  let at = 0;
  for (const title of titles) {
    assert.equal(v.getUint32(at, true), 0x04034b50);
    offsets.push(at);
    const size = v.getUint32(at + 18, true);
    const nameLength = v.getUint16(at + 26, true);
    assert.equal(v.getUint16(at + 6, true) & 0x0800, 0x0800, "UTF-8 flag");
    assert.equal(v.getUint16(at + 8, true), 0, "stored");
    assert.equal(new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength)), `${title}.paprikarecipe`);
    const data = bytes.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    assert.equal(v.getUint32(at + 14, true), crc32(data), "CRC");
    assert.equal(v.getUint32(at + 22, true), size);
    assert.equal(JSON.parse(strFromU8(gunzipSync(data))).name, title);
    at += 30 + nameLength + size;
  }
  // The end record: both counts, and where and how big the directory is.
  const end = bytes.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 8, true), titles.length);
  assert.equal(v.getUint16(end + 10, true), titles.length);
  assert.equal(v.getUint32(end + 16, true), at);
  assert.equal(v.getUint32(end + 12, true), end - at);
  // Each directory entry matches its local header.
  for (const offset of offsets) {
    assert.equal(v.getUint32(at, true), 0x02014b50);
    assert.equal(v.getUint32(at + 42, true), offset);
    assert.equal(v.getUint16(at + 8, true), v.getUint16(offset + 6, true), "flags");
    assert.equal(v.getUint32(at + 16, true), v.getUint32(offset + 14, true), "CRC");
    assert.equal(v.getUint32(at + 20, true), v.getUint32(offset + 18, true), "size");
    assert.equal(v.getUint32(at + 24, true), v.getUint32(offset + 22, true), "uncompressed size");
    assert.equal(v.getUint16(at + 28, true), v.getUint16(offset + 26, true), "name length");
    at += 46 + v.getUint16(at + 28, true);
  }
  assert.equal(at, end);
});

test("written a piece at a time, the file is the same as written whole", () => {
  const recipes = Array.from({ length: 5 }, (_, i) => toPaprika({ ...recipe, id: `p${i}` }, "", 0));
  const pieces: Uint8Array[] = [];
  const zip = paprikaZip((piece) => pieces.push(piece));
  for (const r of recipes) zip.add(r);
  zip.end();
  assert.ok(pieces.length > 5);
  assert.deepEqual(Buffer.concat(pieces), Buffer.from(paprikaFile(recipes)));
});

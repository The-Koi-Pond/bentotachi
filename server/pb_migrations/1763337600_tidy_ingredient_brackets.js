/// <reference path="../pb_data/types.d.ts" />

// Older imports from WP Recipe Maker sites have a stray comma inside
// ingredient brackets: "1 garlic clove (, finely grated)". The reader drops
// it now (cleanText in pb_hooks/recipe_parse.js); this fixes the recipes
// saved before, in their ingredients and method. Pantry links are keyed by
// a line's text, so a changed line's link moves with it.

function tidy(line) {
  return String(line)
    .replace(/\(\s*[,;]\s*/g, "(")
    .replace(/\s*\(\s*\)/g, "");
}

function jsonValue(record, field) {
  const text = record.getString(field);
  return text ? JSON.parse(text) : null;
}

migrate((app) => {
  for (const record of app.findAllRecords("recipes")) {
    let changed = false;
    for (const field of ["ingredients", "steps"]) {
      const lines = jsonValue(record, field);
      if (!Array.isArray(lines)) continue;
      const tidied = lines.map(tidy);
      if (tidied.some((line, i) => line !== lines[i])) {
        record.set(field, tidied);
        changed = true;
      }
    }
    const links = jsonValue(record, "ingredient_links");
    if (links && typeof links === "object") {
      const moved = {};
      let linksChanged = false;
      for (const key of Object.keys(links)) {
        const newKey = tidy(key);
        if (newKey !== key) linksChanged = true;
        // A link already saved under the tidy text wins.
        if (!(newKey in moved) || newKey === key) moved[newKey] = links[key];
      }
      if (linksChanged) {
        record.set("ingredient_links", moved);
        changed = true;
      }
    }
    if (changed) app.save(record);
  }
}, () => {
  // Nothing to undo: the commas weren't wanted.
});

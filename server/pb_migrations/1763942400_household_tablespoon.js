/// <reference path="../pb_data/types.d.ts" />

// What the household's tablespoon holds: 15 (ml, most spoons) or 20 (the
// Australian standard). 0 means not chosen yet, which counts as 15. Recipes
// written for the other size get hints (see web/src/volumes.ts).

migrate((app) => {
  const settings = app.findCollectionByNameOrId("household_settings");
  settings.fields.add(new NumberField({ name: "tablespoon", onlyInt: true, min: 0, max: 20 }));
  app.save(settings);
}, (app) => {
  const settings = app.findCollectionByNameOrId("household_settings");
  settings.fields.removeByName("tablespoon");
  app.save(settings);
});

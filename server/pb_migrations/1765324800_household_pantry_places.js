/// <reference path="../pb_data/types.d.ts" />

// The household's pantry places, in its own order (["Fridge", "Chest
// freezer"]), so a place made in "Edit places" stays while it's empty
// (web/src/PlacePicker.tsx). Places items are in show too, listed or not;
// an empty list (every household until someone edits) means just those.

migrate((app) => {
  const settings = app.findCollectionByNameOrId("household_settings");
  settings.fields.add(new JSONField({ name: "pantry_places", maxSize: 5000 }));
  app.save(settings);
}, (app) => {
  const settings = app.findCollectionByNameOrId("household_settings");
  settings.fields.removeByName("pantry_places");
  app.save(settings);
});

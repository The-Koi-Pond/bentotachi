/// <reference path="../pb_data/types.d.ts" />

// Optional expiry date on pantry items.

migrate((app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.add(new DateField({ name: "expires" }));
  app.save(pantry);
}, (app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("expires");
  app.save(pantry);
});

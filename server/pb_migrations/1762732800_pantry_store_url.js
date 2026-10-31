/// <reference path="../pb_data/types.d.ts" />

// A pantry item's product page in an online store, like Coles' or
// Woolworths' page for the exact Worcestershire sauce we buy. Optional.

migrate((app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.add(new URLField({ name: "store_url" }));
  app.save(pantry);
}, (app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("store_url");
  app.save(pantry);
});

/// <reference path="../pb_data/types.d.ts" />

// The brand we like for a pantry item, like "Lea & Perrins" for
// Worcestershire sauce. Optional; shown on the item and the shopping list.

migrate((app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.add(new TextField({ name: "brand", max: 60 }));
  app.save(pantry);
}, (app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("brand");
  app.save(pantry);
});

/// <reference path="../pb_data/types.d.ts" />

// Barcodes on pantry items: the numbers on the packets (["9300633603161"]),
// so scanning one again finds the item. An item can have several, like
// different brands or sizes of the same thing. See web/src/barcodes.ts.

migrate((app) => {
  const items = app.findCollectionByNameOrId("pantry_items");
  items.fields.add(new JSONField({ name: "barcodes", maxSize: 5000 }));
  app.save(items);
}, (app) => {
  const items = app.findCollectionByNameOrId("pantry_items");
  items.fields.removeByName("barcodes");
  app.save(items);
});

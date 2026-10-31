/// <reference path="../pb_data/types.d.ts" />

// Stage 3, part 1: the pantry, and a link from shopping items back to it.

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';

  const pantry = new Collection({
    type: "base",
    name: "pantry_items",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      { name: "name", type: "text", required: true, max: 200, presentable: true },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["have", "low", "out"] },
      // Where it's kept ("Cupboard") and an optional group within that
      // ("Baking"). Free text; the app suggests ones already used.
      { name: "location", type: "text", max: 100 },
      { name: "subcategory", type: "text", max: 100 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    // One entry per thing: "Eggs" and "eggs" count as the same.
    indexes: ["CREATE UNIQUE INDEX idx_pantry_items_name ON pantry_items (name COLLATE NOCASE)"],
  });
  app.save(pantry);

  const shopping = app.findCollectionByNameOrId("shopping_items");
  shopping.fields.add(new RelationField({ name: "pantry_item", collectionId: pantry.id, maxSelect: 1 }));
  app.save(shopping);
}, (app) => {
  const shopping = app.findCollectionByNameOrId("shopping_items");
  shopping.fields.removeByName("pantry_item");
  app.save(shopping);

  app.delete(app.findCollectionByNameOrId("pantry_items"));
});

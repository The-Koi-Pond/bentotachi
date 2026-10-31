/// <reference path="../pb_data/types.d.ts" />

// Stage 2: the shared shopping list.

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';
  const users = app.findCollectionByNameOrId("users");
  const recipes = app.findCollectionByNameOrId("recipes");

  const items = new Collection({
    type: "base",
    name: "shopping_items",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      { name: "text", type: "text", required: true, max: 500, presentable: true },
      { name: "checked", type: "bool" },
      // Which recipe it was added from, if any. Cleared if that recipe is deleted.
      { name: "recipe", type: "relation", collectionId: recipes.id, maxSelect: 1 },
      { name: "added_by", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_shopping_items_checked ON shopping_items (checked)"],
  });
  app.save(items);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("shopping_items"));
});

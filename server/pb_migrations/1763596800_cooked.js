/// <reference path="../pb_data/types.d.ts" />

// "We cooked this": a day someone cooked a recipe, from the button on its
// page (or finishing its timer). With past nights on the dinner plan, these
// make a recipe's "Last had" history. Anyone logged in can add one or take
// it back; deleting a recipe deletes its history too.

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';
  const users = app.findCollectionByNameOrId("users");
  const recipes = app.findCollectionByNameOrId("recipes");

  const cooked = new Collection({
    type: "base",
    name: "cooked",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      // Stored as "2026-11-02 00:00:00.000Z", like the dinner plan; only the
      // date part is used (see web/src/dates.ts).
      { name: "date", type: "date", required: true },
      { name: "recipe", type: "relation", collectionId: recipes.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "cooked_by", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_cooked_recipe ON cooked (recipe)"],
  });
  app.save(cooked);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("cooked"));
});

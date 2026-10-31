/// <reference path="../pb_data/types.d.ts" />

// The dinner plan: one recipe per date. Anyone logged in can plan, move and
// remove dinners; deleting a recipe takes it off the plan too.

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';
  const users = app.findCollectionByNameOrId("users");
  const recipes = app.findCollectionByNameOrId("recipes");

  const plan = new Collection({
    type: "base",
    name: "meal_plan",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      // Stored as "2026-11-02 00:00:00.000Z"; only the date part is used.
      { name: "date", type: "date", required: true },
      { name: "recipe", type: "relation", collectionId: recipes.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "added_by", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    // One dinner per night.
    indexes: ["CREATE UNIQUE INDEX idx_meal_plan_date ON meal_plan (date)"],
  });
  app.save(plan);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("meal_plan"));
});

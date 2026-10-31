/// <reference path="../pb_data/types.d.ts" />

// Each person's own take on a recipe: stars (0 = not rated), favorite, and
// their seal of approval. One row per person per recipe. Everyone can see
// them all; each person can only change their own.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const recipes = app.findCollectionByNameOrId("recipes");

  const ratings = new Collection({
    type: "base",
    name: "recipe_ratings",
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    // Your own row only, and it can't be moved to another person or recipe.
    updateRule: "user = @request.auth.id && @request.body.user:isset = false && @request.body.recipe:isset = false",
    deleteRule: "user = @request.auth.id",
    fields: [
      // Deleting a recipe or a person removes their ratings too.
      { name: "recipe", type: "relation", collectionId: recipes.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "stars", type: "number", onlyInt: true, min: 0, max: 5 },
      { name: "favorite", type: "bool" },
      { name: "approved", type: "bool" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_recipe_ratings_once ON recipe_ratings (recipe, user)"],
  });
  app.save(ratings);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("recipe_ratings"));
});

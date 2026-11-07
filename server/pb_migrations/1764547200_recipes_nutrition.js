/// <reference path="../pb_data/types.d.ts" />

// Nutrition facts per serving, as most recipe apps keep them (Xel,
// 2026-11-07): a JSON list of lines like "Calories: 420 kcal", from a
// website's recipe data (recipe_parse.js nutritionLines) or a Paprika file.
// Kept on every recipe, shown only to people who turn on "Show nutrition"
// (users.show_nutrition, in the ⋮ menu): some would rather not see it.
// People can already edit their own account, so no new rules are needed.

migrate((app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.add(new JSONField({ name: "nutrition", maxSize: 20000 }));
  app.save(recipes);
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "show_nutrition" }));
  app.save(users);
}, (app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.removeByName("nutrition");
  app.save(recipes);
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("show_nutrition");
  app.save(users);
});

/// <reference path="../pb_data/types.d.ts" />

// The recipe website's own rating, saved when a recipe is imported from a
// link (recipe_parse.js siteRating): site_rating out of 5 (0 = none) and
// how many people gave it. Shown in grey ★ on a card until the household
// rates it in onigiri, and on the recipe page.

migrate((app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.add(new NumberField({ name: "site_rating", min: 0, max: 5 }));
  recipes.fields.add(new NumberField({ name: "site_rating_count", min: 0, onlyInt: true }));
  app.save(recipes);
}, (app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.removeByName("site_rating");
  recipes.fields.removeByName("site_rating_count");
  app.save(recipes);
});

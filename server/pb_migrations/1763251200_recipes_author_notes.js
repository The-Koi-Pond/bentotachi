/// <reference path="../pb_data/types.d.ts" />

// Author's notes: the recipe writer's own tips from the original page
// (swaps, storage, make-ahead), kept apart from the household's "Our notes".
// Imports fill it from the page's notes box where there is one.

migrate((app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.add(new TextField({ name: "author_notes", max: 20000 }));
  app.save(recipes);
}, (app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.removeByName("author_notes");
  app.save(recipes);
});

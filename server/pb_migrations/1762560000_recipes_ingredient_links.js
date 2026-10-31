/// <reference path="../pb_data/types.d.ts" />

// Which pantry item each of a recipe's ingredient lines is linked to, when
// someone has chosen (guesses aren't stored). Keyed by the line's text in
// lowercase: { "2 onions, diced": "<pantry item id>", "water": "" }, where
// "" means "not a pantry item". See web/src/pantryLinks.ts.

migrate((app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.add(new JSONField({ name: "ingredient_links", maxSize: 50000 }));
  app.save(recipes);
}, (app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.removeByName("ingredient_links");
  app.save(recipes);
});

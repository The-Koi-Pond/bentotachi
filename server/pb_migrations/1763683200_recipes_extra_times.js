/// <reference path="../pb_data/types.d.ts" />

// Extra named times on a recipe besides prep and cook, like "Cool" 420 or
// "Release" 10: [{ "label": "Cool", "minutes": 420 }, …]. Shown with the
// other times, and counted in the total when the recipe doesn't give one
// (see totalMinutes in web/src/format.ts).

migrate((app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.add(new JSONField({ name: "extra_times", maxSize: 5000 }));
  app.save(recipes);
}, (app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.removeByName("extra_times");
  app.save(recipes);
});

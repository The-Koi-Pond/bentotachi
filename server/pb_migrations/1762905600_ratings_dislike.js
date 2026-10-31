/// <reference path="../pb_data/types.d.ts" />

// A thumbs down on a recipe, with reasons as short tags ("baked pineapple"),
// so the household can see what each person doesn't like about it. The
// existing rules apply: everyone can see them, each person changes only
// their own.

migrate((app) => {
  const ratings = app.findCollectionByNameOrId("recipe_ratings");
  ratings.fields.add(new BoolField({ name: "disliked" }));
  ratings.fields.add(new JSONField({ name: "dislike_reasons", maxSize: 5000 }));
  app.save(ratings);
}, (app) => {
  const ratings = app.findCollectionByNameOrId("recipe_ratings");
  ratings.fields.removeByName("dislike_reasons");
  ratings.fields.removeByName("disliked");
  app.save(ratings);
});

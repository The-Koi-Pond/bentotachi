/// <reference path="../pb_data/types.d.ts" />

// More photos per recipe besides the cover (Xel, 2026-11-07): how ours
// turned out, Nan's handwritten card, the cookbook page, and photos for a
// step, like Paprika's gallery and Tandoor's step photos. "image" stays the
// cover (cards, the meal plan and imports keep using it); "photos" are the
// rest, shrunk by the app before sending (1600 pixels across), with a
// 600-wide copy for step cards. "photo_steps" says which step a photo goes
// with: { "<photo file name>": "<the step's wording, lower case>" }, kept
// when a step is reworded (web/src/recipePhotos.ts); a photo whose step is
// gone shows with the others. Backups carry the files like the cover's.

migrate((app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.add(
    new FileField({
      name: "photos",
      maxSelect: 20,
      maxSize: 10 * 1024 * 1024,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
      thumbs: ["600x0"],
    })
  );
  recipes.fields.add(new JSONField({ name: "photo_steps", maxSize: 50000 }));
  app.save(recipes);
}, (app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.removeByName("photos");
  recipes.fields.removeByName("photo_steps");
  app.save(recipes);
});

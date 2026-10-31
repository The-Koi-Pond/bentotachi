/// <reference path="../pb_data/types.d.ts" />

// How a recipe's photo is framed: { x, y, zoom }, where x and y (0-100) are
// the point of the photo to keep in view and zoom (1-3) how far in. The
// photo itself is never changed, so the framing can always be reset. See
// web/src/photoFraming.ts.
//
// Also a 600-wide thumbnail that keeps the photo's shape ("600x0"): the
// 600x400 one is already cut to the middle, so a card framed off-centre
// needs the whole photo to choose from.

migrate((app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.add(new JSONField({ name: "image_framing", maxSize: 2000 }));
  const image = recipes.fields.getByName("image");
  if (!image.thumbs.includes("600x0")) image.thumbs = [...image.thumbs, "600x0"];
  app.save(recipes);
}, (app) => {
  const recipes = app.findCollectionByNameOrId("recipes");
  recipes.fields.removeByName("image_framing");
  const image = recipes.fields.getByName("image");
  image.thumbs = image.thumbs.filter((thumb) => thumb !== "600x0");
  app.save(recipes);
});

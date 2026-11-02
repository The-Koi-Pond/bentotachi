/// <reference path="../pb_data/types.d.ts" />

// Pantry items can have several store links (say a Coles one and a
// Woolworths one): store_url stays the first, and more_store_urls holds the
// rest as a list of web addresses. Kept that way rather than moving them all
// into one list so apps from before this (1.12.1 and older) still show and
// edit the first link, and saving there leaves the others alone. The app
// reads them together (storeLinksOf in web/src/pantryItem.ts), up to 5.

migrate((app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.add(new JSONField({ name: "more_store_urls", maxSize: 20000 }));
  app.save(pantry);
}, (app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("more_store_urls");
  app.save(pantry);
});

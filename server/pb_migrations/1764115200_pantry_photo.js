/// <reference path="../pb_data/types.d.ts" />

// A photo on pantry items: taken with the phone, chosen from its pictures,
// or the product's photo from its store link (pantry_photo.pb.js). The app
// shrinks photos before sending them (web/src/pantryPhoto.ts), so they stay
// small; the 160x160 thumbnail keeps the whole packet in view ("f": fit
// inside, nothing cut off) for the pantry list.
//
// photo_link_tried: the store link whose photo the app last fetched (or
// tried to), so it doesn't fetch it again, and a removed photo stays
// removed (wantsLinkPhoto in web/src/pantryItem.ts).

migrate((app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.add(new TextField({ name: "photo_link_tried", max: 2000 }));
  pantry.fields.add(
    new FileField({
      name: "photo",
      maxSelect: 1,
      maxSize: 10 * 1024 * 1024,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
      thumbs: ["160x160f"],
    })
  );
  app.save(pantry);
}, (app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("photo");
  pantry.fields.removeByName("photo_link_tried");
  app.save(pantry);
});

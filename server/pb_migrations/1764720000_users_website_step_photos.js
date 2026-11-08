/// <reference path="../pb_data/types.d.ts" />

// "Bring step photos from websites", off unless chosen: a
// recipe saved from a link then also brings the photos its page gives for
// its steps (import.pb.js), shown in those steps. Off by default because a
// recipe can have 15 or more, which fills a phone-only phone and its
// backups for people who don't want them. Saved on each person's account,
// like "Show nutrition"; people can already edit their own account.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "website_step_photos" }));
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("website_step_photos");
  app.save(users);
});

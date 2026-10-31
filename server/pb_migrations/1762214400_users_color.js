/// <reference path="../pb_data/types.d.ts" />

// Each person's color, like "#7048e8", used for their name and seals in the
// app. Chosen in the app's settings menu, or set in the admin dashboard.
// Empty means Bento's usual orange.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "color", max: 7, pattern: "^(#[0-9a-fA-F]{6})?$" }));
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("color");
  app.save(users);
});

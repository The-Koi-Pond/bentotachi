/// <reference path="../pb_data/types.d.ts" />

// Each person's "quick recipe" limit in minutes, set in the app's settings
// menu. Empty (0) means the default, 30. People can already edit their own
// account, so no new rules are needed.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new NumberField({ name: "quick_minutes", onlyInt: true, min: 0, max: 600 }));
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("quick_minutes");
  app.save(users);
});

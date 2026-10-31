/// <reference path="../pb_data/types.d.ts" />

// The household's own recipe sites on the Browse tab, alongside the built-in
// ones. Anyone logged in can add, rename and remove them.

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';
  const users = app.findCollectionByNameOrId("users");

  const sites = new Collection({
    type: "base",
    name: "saved_sites",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      { name: "name", type: "text", required: true, max: 60 },
      { name: "url", type: "url", required: true },
      { name: "added_by", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(sites);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("saved_sites"));
});

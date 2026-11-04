/// <reference path="../pb_data/types.d.ts" />

// The fridge door's notes (web/src/pages/Fridge.tsx): short messages anyone
// in the household leaves for everyone else, like "Don't buy eggs, I got two
// dozen". Anyone logged in can read, add, change or take one down. added_by
// is always whoever posted it (pb_hooks/who_added.pb.js); a deleted account
// leaves its notes, unsigned.

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';
  const users = app.findCollectionByNameOrId("users");

  const notes = new Collection({
    type: "base",
    name: "notes",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      { name: "text", type: "text", required: true, max: 500 },
      { name: "added_by", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_notes_created ON notes (created)"],
  });
  app.save(notes);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("notes"));
});

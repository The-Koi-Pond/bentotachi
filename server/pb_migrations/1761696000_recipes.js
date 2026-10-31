/// <reference path="../pb_data/types.d.ts" />

// Database setup for stage 1: household accounts and the shared cookbook.
// PocketBase runs each file in this folder once, in name order.

migrate((app) => {
  // Household accounts. Nobody can sign themselves up; accounts are made in
  // the admin dashboard. Logged-in members can see each other's names.
  const users = app.findCollectionByNameOrId("users");
  users.createRule = null;
  users.listRule = '@request.auth.id != ""';
  users.viewRule = '@request.auth.id != ""';
  app.save(users);

  const loggedIn = '@request.auth.id != ""';

  const recipes = new Collection({
    type: "base",
    name: "recipes",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      { name: "title", type: "text", required: true, max: 300, presentable: true },
      { name: "description", type: "text", max: 5000 },
      { name: "source_url", type: "url" },
      {
        name: "image",
        type: "file",
        maxSelect: 1,
        maxSize: 10 * 1024 * 1024,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
        thumbs: ["600x400"],
      },
      { name: "servings", type: "text", max: 100 },
      { name: "prep_minutes", type: "number", onlyInt: true, min: 0 },
      { name: "cook_minutes", type: "number", onlyInt: true, min: 0 },
      { name: "total_minutes", type: "number", onlyInt: true, min: 0 },
      // Lists of text lines. A line starting with "# " is shown as a heading.
      { name: "ingredients", type: "json", maxSize: 200000 },
      { name: "steps", type: "json", maxSize: 200000 },
      { name: "tags", type: "json", maxSize: 20000 },
      { name: "notes", type: "text", max: 20000 },
      { name: "added_by", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_recipes_title ON recipes (title)"],
  });
  app.save(recipes);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("recipes"));

  const users = app.findCollectionByNameOrId("users");
  users.createRule = "";
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  app.save(users);
});

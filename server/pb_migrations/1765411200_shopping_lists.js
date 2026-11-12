/// <reference path="../pb_data/types.d.ts" />

// Several shopping lists (docs/PLAN.md, "several shopping lists"): the
// household's lists, one of them the main one, made here. The main list
// can't be deleted, and a row with no list is on it (older apps, and the
// "ran out" rule in pantry.pb.js). Deleting another list deletes its rows.

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';
  const users = app.findCollectionByNameOrId("users");
  const lists = new Collection({
    type: "base",
    name: "shopping_lists",
    listRule: loggedIn,
    viewRule: loggedIn,
    // Only ever the one main list, made here: the app can't make or unmake one.
    createRule: loggedIn + " && @request.body.main:isset = false",
    updateRule: loggedIn + " && @request.body.main:isset = false",
    deleteRule: loggedIn + " && main = false",
    fields: [
      { name: "name", type: "text", required: true, max: 60, presentable: true },
      { name: "main", type: "bool" },
      { name: "added_by", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(lists);

  const main = new Record(lists);
  main.set("name", "Shopping list");
  main.set("main", true);
  app.save(main);

  const items = app.findCollectionByNameOrId("shopping_items");
  items.fields.add(new RelationField({ name: "list", collectionId: lists.id, maxSelect: 1, cascadeDelete: true }));
  items.addIndex("idx_shopping_items_list", false, "list", "");
  app.save(items);
}, (app) => {
  const items = app.findCollectionByNameOrId("shopping_items");
  items.removeIndex("idx_shopping_items_list");
  items.fields.removeByName("list");
  app.save(items);
  app.delete(app.findCollectionByNameOrId("shopping_lists"));
});

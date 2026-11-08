/// <reference path="../pb_data/types.d.ts" />

// Kinds of one thing (docs/PLAN.md, "Kinds of one thing"): kind_of names the
// group a pantry item is a kind of ("Pasta" for Linguine, Penne and
// Spaghetti). The pantry shows kinds under that name, a recipe line naming
// a kind links to that kind only, and one naming just the group ("500 g
// pasta") takes any kind in it (web/src/pantryLinks.ts). Empty for
// everything until someone sets it, so nothing changes by itself.

migrate((app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.add(new TextField({ name: "kind_of", max: 60 }));
  app.save(pantry);
}, (app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("kind_of");
  app.save(pantry);
});

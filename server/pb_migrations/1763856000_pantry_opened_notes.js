/// <reference path="../pb_data/types.d.ts" />

// Pantry items get:
// - a note, for anything worth writing down: "3 cans", "3 packets, don't
//   need more for a while";
// - where they go once opened ("Fridge"), and whether one is open now. An
//   opened item shows in that place; running out puts it back in its own
//   place, ready for the next unopened one (see web/src/pantryItem.ts);
// - room for several brands ("Coles, White Mill"): one item per thing, with
//   every brand the household buys of it.

migrate((app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.add(new TextField({ name: "note", max: 200 }));
  pantry.fields.add(new TextField({ name: "opened_location", max: 100 }));
  pantry.fields.add(new BoolField({ name: "opened" }));
  pantry.fields.getByName("brand").max = 120;
  app.save(pantry);
}, (app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("note");
  pantry.fields.removeByName("opened_location");
  pantry.fields.removeByName("opened");
  pantry.fields.getByName("brand").max = 60;
  app.save(pantry);
});

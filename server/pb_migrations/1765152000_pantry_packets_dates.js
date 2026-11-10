/// <reference path="../pb_data/types.d.ts" />

// Each one in stock is its own label (docs/VISION.md, "Pantry labels"): its
// own use-by date (`expires`), the day it was opened (`opened`, empty while
// sealed) and the day it was bought (`bought`, empty means the day it was
// added, which the app shows instead). The item's own `expires` becomes the
// soonest label's, kept by the server (pb_hooks/pantry_labels.js); an item
// nobody counts (no labels) keeps its own, as before. The item's `opened`
// and `opened_location` (the old "once opened, keep in" place) are no
// longer used.
//
// Moving what's there: an item with labels gives its date to its oldest one,
// and, if it's opened, marks that one opened (on the day the item last
// changed, the nearest known), so who opened what isn't lost. Saved without
// the server's hooks: they'd work out the item's products and links from a
// label before the products migration has run.

migrate((app) => {
  const packets = app.findCollectionByNameOrId("pantry_packets");
  packets.fields.add(new DateField({ name: "expires" }));
  packets.fields.add(new DateField({ name: "opened" }));
  packets.fields.add(new DateField({ name: "bought" }));
  app.save(packets);

  const quiet = app.unsafeWithoutHooks();
  const items = app.findRecordsByFilter("pantry_items", "expires != '' || opened = true", "", 0, 0);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const own = app.findRecordsByFilter("pantry_packets", "item = {:item}", "created", 1, 0, { item: item.id });
    if (!own.length) continue;
    const oldest = own[0];
    if (item.getString("expires")) oldest.set("expires", item.getString("expires"));
    if (item.getBool("opened")) oldest.set("opened", item.getString("updated"));
    quiet.save(oldest);
  }
}, (app) => {
  const packets = app.findCollectionByNameOrId("pantry_packets");
  packets.fields.removeByName("expires");
  packets.fields.removeByName("opened");
  packets.fields.removeByName("bought");
  app.save(packets);
});

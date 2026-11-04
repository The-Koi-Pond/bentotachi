/// <reference path="../pb_data/types.d.ts" />

// Packets in stock (docs/PLAN.md, "Packets in stock"): one record per bag,
// jar or can actually in the cupboard, with its brand and size ("White
// Mill", "1 kg") and the barcode it was scanned from, if any. Each is its
// own record, so two phones finishing different packets at once don't undo
// each other. Removing the item removes its packets; marking it Out clears
// them (pb_hooks/pantry.pb.js). Anyone logged in can read and change them.
//
// barcode_details on pantry items remembers each barcode's brand and size
// ({"9300633603161": {"brand": "White Mill", "size": "1 kg"}}), so the next
// packet scanned with it is filled in without asking Open Food Facts again.

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';
  const pantry = app.findCollectionByNameOrId("pantry_items");

  const packets = new Collection({
    type: "base",
    name: "pantry_packets",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      { name: "item", type: "relation", collectionId: pantry.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "brand", type: "text", max: 120 },
      { name: "size", type: "text", max: 60 },
      { name: "barcode", type: "text", max: 20 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_pantry_packets_item ON pantry_packets (item)"],
  });
  app.save(packets);

  pantry.fields.add(new JSONField({ name: "barcode_details", maxSize: 20000 }));
  app.save(pantry);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pantry_packets"));
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("barcode_details");
  app.save(pantry);
});

/// <reference path="../pb_data/types.d.ts" />

// What's left of a partly used packet ("100 g"), written by cooking: a
// recipe marked Finished takes what it used from the pantry's packets
// (docs/PLAN.md, "Using things up when a meal is cooked"), and one it only
// partly used keeps the rest here. Empty means the packet is full (its
// size), as every packet was before; nobody types this by hand.

migrate((app) => {
  const packets = app.findCollectionByNameOrId("pantry_packets");
  packets.fields.add(new TextField({ name: "left", max: 60 }));
  app.save(packets);
}, (app) => {
  const packets = app.findCollectionByNameOrId("pantry_packets");
  packets.fields.removeByName("left");
  app.save(packets);
});

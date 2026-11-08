/// <reference path="../pb_data/types.d.ts" />

// Ticking something bought on the shopping list adds a packet to the pantry
// (pb_hooks/pantry.pb.js), so packet counts don't go stale. usual_packet on
// a pantry item is the brand and size of the last packet added to it
// ({"brand": "White Mill", "size": "1 kg"}), kept after the packets are gone
// so a bought item still knows what to add. bought_with on a packet is the
// shopping item whose tick added it, so unticking takes that one back off.
// Items that have packets now get their newest one as their usual packet.

migrate((app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.add(new JSONField({ name: "usual_packet", maxSize: 500 }));
  app.save(pantry);

  const packets = app.findCollectionByNameOrId("pantry_packets");
  packets.fields.add(new TextField({ name: "bought_with", max: 30 }));
  app.save(packets);

  const newest = app.findRecordsByFilter("pantry_packets", "brand != '' || size != ''", "-created", 0, 0);
  const done = {};
  for (let i = 0; i < newest.length; i++) {
    const packet = newest[i];
    const itemId = packet.get("item");
    if (done[itemId]) continue;
    done[itemId] = true;
    try {
      const item = app.findRecordById("pantry_items", itemId);
      item.set("usual_packet", { brand: packet.get("brand"), size: packet.get("size") });
      app.save(item);
    } catch (err) {
      // Its item is gone (the packet goes with it): nothing to remember.
    }
  }
}, (app) => {
  const pantry = app.findCollectionByNameOrId("pantry_items");
  pantry.fields.removeByName("usual_packet");
  app.save(pantry);
  const packets = app.findCollectionByNameOrId("pantry_packets");
  packets.fields.removeByName("bought_with");
  app.save(packets);
});

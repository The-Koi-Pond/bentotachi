/// <reference path="../pb_data/types.d.ts" />

// Keeps the pantry and the shopping list in step. These run on the server so
// they apply whoever made the change, from any phone.

// Marked "out" -> put it on the shopping list. If it's already there (linked,
// or typed by hand with the same name), don't add it twice; link the
// hand-typed one instead so ticking it updates the pantry. "Already there"
// is the app's rule too (sameThing, web/src/shoppingMatch.ts): keep them alike.
// Apps from 2026-11-02 on ask first ("Put it on the shopping list?": it may
// not be wanted again for a while) and send "ask_about_list": true, so then
// it isn't added here; a hand-typed one is still linked. Older apps don't
// ask, so for them it's added as before. Runs on the request (not after any
// save) because only the request says which app it came from.
onRecordUpdateRequest((e) => {
  const wasOut = e.record.original().get("status") === "out";
  const asks = [true, "true"].includes(e.requestInfo().body.ask_about_list);
  e.next();
  const becameOut = !wasOut && e.record.get("status") === "out";
  if (becameOut) {
    const name = String(e.record.get("name")).trim().toLowerCase();
    const waiting = e.app.findRecordsByFilter("shopping_items", "checked = false", "", 0, 0);
    let match = null;
    // A plain index loop: the list comes from Go and may not support for...of.
    for (let i = 0; i < waiting.length; i++) {
      const item = waiting[i];
      if (item.get("pantry_item") === e.record.id) {
        match = item;
        break;
      }
      if (!match && !item.get("pantry_item") && String(item.get("text")).trim().toLowerCase() === name) {
        match = item;
      }
    }

    if (!match && !asks) {
      const item = new Record(e.app.findCollectionByNameOrId("shopping_items"));
      item.set("text", e.record.get("name"));
      item.set("checked", false);
      item.set("pantry_item", e.record.id);
      e.app.save(item);
    } else if (match && !match.get("pantry_item")) {
      match.set("pantry_item", e.record.id);
      e.app.save(match);
    }

    // Out means none left, so its packets in stock go too (from any app,
    // older ones included; the new ones offer Undo, which adds them back).
    const packets = e.app.findRecordsByFilter("pantry_packets", "item = {:item}", "", 0, 0, { item: e.record.id });
    for (let i = 0; i < packets.length; i++) e.app.delete(packets[i]);
  }
}, "pantry_items");

// Ticked off on the shopping list -> it's in the pantry again ("have"). If
// it had run out, the old expiry date belonged to what ran out, so it's
// cleared; if it was Have or Low (more bought while some is left), the date
// stays: that older stock is still there and goes off first.
// Unticked again -> it's still needed, so "low" (we can't know if it was
// low or out before).
// For an item that uses packets (it has a usual one, see the
// pantry_usual_packet migration), ticking also adds a packet like the last
// one, so the count stays right without anyone adding it by hand; unticking
// within the hour takes that packet back off. One packet per tick: "2 tins" can't be read
// reliably, and a count off by one is easy to fix.
onRecordAfterUpdateSuccess((e) => {
  const pantryId = e.record.get("pantry_item");
  const checked = e.record.get("checked");
  if (pantryId && checked !== e.record.original().get("checked")) {
    try {
      const pantryItem = e.app.findRecordById("pantry_items", pantryId);
      const status = pantryItem.get("status");
      if (checked && status !== "have") {
        if (status === "out") pantryItem.set("expires", "");
        pantryItem.set("status", "have");
        e.app.save(pantryItem);
      } else if (!checked && status === "have") {
        pantryItem.set("status", "low");
        e.app.save(pantryItem);
      }

      if (checked) {
        let usual = null;
        try {
          usual = JSON.parse(pantryItem.getString("usual_packet") || "null");
        } catch (err) {
          // Not readable JSON: treat it as no usual packet.
        }
        if (usual && (usual.brand || usual.size)) {
          const packet = new Record(e.app.findCollectionByNameOrId("pantry_packets"));
          packet.set("item", pantryId);
          packet.set("brand", String(usual.brand || ""));
          packet.set("size", String(usual.size || ""));
          packet.set("bought_with", e.record.id);
          e.app.save(packet);
        }
      } else {
        // Only a tick from the last hour is taken back (a mis-tap): an old
        // "Got it" row put back on the list days later was really bought,
        // and its bag may well still be in the cupboard.
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace("T", " ");
        const added = e.app.findRecordsByFilter("pantry_packets", "bought_with = {:id} && created >= {:since}", "", 0, 0, {
          id: e.record.id,
          since: since,
        });
        for (let i = 0; i < added.length; i++) e.app.delete(added[i]);
      }
    } catch (err) {
      e.app.logger().warn("Couldn't update pantry from shopping list", "error", String(err));
    }
  }
  e.next();
}, "shopping_items");

// A packet added with a brand or size becomes its item's usual packet: what
// ticking it off the shopping list adds next time (see above).
onRecordAfterCreateSuccess((e) => {
  const brand = e.record.getString("brand");
  const size = e.record.getString("size");
  if (brand || size) {
    try {
      const item = e.app.findRecordById("pantry_items", e.record.get("item"));
      let usual = null;
      try {
        usual = JSON.parse(item.getString("usual_packet") || "null");
      } catch (err) {
        // Not readable JSON: replaced below.
      }
      if (!usual || usual.brand !== brand || usual.size !== size) {
        item.set("usual_packet", { brand: brand, size: size });
        e.app.save(item);
      }
    } catch (err) {
      e.app.logger().warn("Couldn't remember the usual packet", "error", String(err));
    }
  }
  e.next();
}, "pantry_packets");

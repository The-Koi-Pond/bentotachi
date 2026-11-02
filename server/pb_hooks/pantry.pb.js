/// <reference path="../pb_data/types.d.ts" />

// Keeps the pantry and the shopping list in step. These run on the server so
// they apply whoever made the change, from any phone.

// Marked "out" -> put it on the shopping list. If it's already there (linked,
// or typed by hand with the same name), don't add it twice; link the
// hand-typed one instead so ticking it updates the pantry.
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
  }
}, "pantry_items");

// Ticked off on the shopping list -> it's in the pantry again ("have"). If
// it had run out, the old expiry date belonged to what ran out, so it's
// cleared; if it was Have or Low (more bought while some is left), the date
// stays: that older stock is still there and goes off first.
// Unticked again -> it's still needed, so "low" (we can't know if it was
// low or out before).
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
    } catch (err) {
      e.app.logger().warn("Couldn't update pantry from shopping list", "error", String(err));
    }
  }
  e.next();
}, "shopping_items");

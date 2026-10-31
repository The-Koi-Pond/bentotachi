/// <reference path="../pb_data/types.d.ts" />

// Keeps the pantry and the shopping list in step. These run on the server so
// they apply whoever made the change, from any phone.

// Marked "out" -> put it on the shopping list. If it's already there (linked,
// or typed by hand with the same name), don't add it twice; link the
// hand-typed one instead so ticking it updates the pantry.
onRecordAfterUpdateSuccess((e) => {
  const becameOut = e.record.get("status") === "out" && e.record.original().get("status") !== "out";
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

    if (!match) {
      const item = new Record(e.app.findCollectionByNameOrId("shopping_items"));
      item.set("text", e.record.get("name"));
      item.set("checked", false);
      item.set("pantry_item", e.record.id);
      e.app.save(item);
    } else if (!match.get("pantry_item")) {
      match.set("pantry_item", e.record.id);
      e.app.save(match);
    }
  }
  e.next();
}, "pantry_items");

// Ticked off on the shopping list -> it's in the pantry again ("have"), with
// the old expiry date cleared.
// Unticked again -> it's still needed, so "low" (we can't know if it was
// low or out before).
onRecordAfterUpdateSuccess((e) => {
  const pantryId = e.record.get("pantry_item");
  const checked = e.record.get("checked");
  if (pantryId && checked !== e.record.original().get("checked")) {
    try {
      const pantryItem = e.app.findRecordById("pantry_items", pantryId);
      const status = pantryItem.get("status");
      if (checked && (status !== "have" || pantryItem.getString("expires") !== "")) {
        // Fresh stock: the old expiry date belonged to what ran out.
        pantryItem.set("status", "have");
        pantryItem.set("expires", "");
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

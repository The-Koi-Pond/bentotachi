/// <reference path="../pb_data/types.d.ts" />

// "Added by" and "Cooked by" always name whoever is logged in, whatever the
// app sends, so one member can't put something under another's name. On
// edits they keep their old value. The admin page (/_/) can still change
// them, since its accounts aren't household members.

onRecordCreateRequest(
  (e) => {
    if (e.auth && e.auth.collection().name === "users") {
      const field = e.record.collection().name === "cooked" ? "cooked_by" : "added_by";
      e.record.set(field, e.auth.id);
    }
    e.next();
  },
  "recipes",
  "shopping_items",
  "shopping_lists",
  "meal_plan",
  "saved_sites",
  "cooked",
  "notes"
);

onRecordUpdateRequest(
  (e) => {
    if (e.auth && e.auth.collection().name === "users") {
      const field = e.record.collection().name === "cooked" ? "cooked_by" : "added_by";
      e.record.set(field, e.record.original().get(field));
    }
    e.next();
  },
  "recipes",
  "shopping_items",
  "shopping_lists",
  "meal_plan",
  "saved_sites",
  "cooked",
  "notes"
);

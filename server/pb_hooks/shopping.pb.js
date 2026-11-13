/// <reference path="../pb_data/types.d.ts" />

// A recipe deleted: shopping-list lines keep its share (their `shares`,
// pb_migrations/1765497600_shopping_item_shares.js) as its words and title,
// without its id, so the line's book shows "(deleted)" rather than linking
// to a recipe that's gone. (The `recipe` relation clears by itself.)
onRecordAfterDeleteSuccess((e) => {
  const id = e.record.id;
  try {
    const rows = e.app.findRecordsByFilter("shopping_items", "shares ~ {:id}", "", 0, 0, { id });
    for (const row of rows) {
      const shares = JSON.parse(row.getString("shares") || "[]");
      if (!Array.isArray(shares)) continue;
      row.set(
        "shares",
        shares.map((share) => (share && share.recipe === id ? Object.assign({}, share, { recipe: "" }) : share))
      );
      e.app.save(row);
    }
  } catch (err) {
    e.app.logger().warn("Couldn't take a deleted recipe off the shopping list's shares", "recipe", id, "error", String(err));
  }
  e.next();
}, "recipes");

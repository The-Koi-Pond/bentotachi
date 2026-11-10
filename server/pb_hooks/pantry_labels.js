// An item's own `expires` kept as the soonest of its labels' (each one in
// stock, pantry_packets; docs/VISION.md, "Pantry labels"). Not a hook (no
// .pb.js): the pantry hooks require it, and the Node tests load it.

// The soonest of the labels' use-by dates (PocketBase's "2026-12-14
// 00:00:00.000Z"), or "" when none has one.
function soonestExpiry(labels) {
  let soonest = "";
  for (let i = 0; i < labels.length; i++) {
    const expires = String(labels[i].expires || "");
    if (expires && (!soonest || expires < soonest)) soonest = expires;
  }
  return soonest;
}

// Brings the item's date up to date. An item with no labels left keeps its
// own: nobody counts it now (or it just ran out, which clears it itself).
function sumUp(app, itemId) {
  let item;
  try {
    item = app.findRecordById("pantry_items", itemId);
  } catch (err) {
    // The item itself was just removed (its labels go with it): nothing to do.
    return;
  }
  // Out clears its labels one by one, and its date itself: summing up
  // part-way would put back the date of the last one left.
  if (item.getString("status") === "out") return;
  const labels = app.findRecordsByFilter("pantry_packets", "item = {:item}", "", 0, 0, { item: itemId });
  if (!labels.length) return;
  const soonest = soonestExpiry(labels.map((label) => ({ expires: label.getString("expires") })));
  if (item.getString("expires") === soonest) return;
  item.set("expires", soonest);
  app.save(item);
}

// A use-by date given to the item itself while it has labels (apps from
// before labels still offer that box): onto its oldest label without one,
// as the labels migration did, or summing up would put the labels' date
// back over it. A label's own date is never replaced (with every label
// dated, theirs stand). Not when a label has that date already (this app's
// Undo of Out sends the item's date back along with its labels).
function dateOnOldest(app, itemId, date) {
  const labels = app.findRecordsByFilter("pantry_packets", "item = {:item}", "created", 0, 0, { item: itemId });
  let undated = null;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i].getString("expires") === date) return;
    if (!undated && !labels[i].getString("expires")) undated = labels[i];
  }
  if (!undated) return;
  undated.set("expires", date);
  app.save(undated);
}

module.exports = { soonestExpiry, sumUp, dateOnOldest };

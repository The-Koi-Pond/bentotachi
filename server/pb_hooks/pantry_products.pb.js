/// <reference path="../pb_data/types.d.ts" />

// Keeps each pantry item's products and the fields kept from them in step,
// whichever app or phone changes things (pantry_products.js says how).

onRecordCreateRequest((e) => {
  require(`${__hooks}/pantry_products.js`).keepProducts(e, true);
  e.next();
}, "pantry_items");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/pantry_products.js`).keepProducts(e, false);
  e.next();
}, "pantry_items");

onRecordAfterCreateSuccess((e) => {
  try {
    require(`${__hooks}/pantry_products.js`).rememberProduct(e.app, e.record);
  } catch (err) {
    e.app.logger().warn("Couldn't remember the pantry product", "error", String(err));
  }
  e.next();
}, "pantry_packets");

onRecordAfterUpdateSuccess((e) => {
  try {
    require(`${__hooks}/pantry_products.js`).rememberProduct(e.app, e.record);
  } catch (err) {
    e.app.logger().warn("Couldn't remember the pantry product", "error", String(err));
  }
  e.next();
}, "pantry_packets");

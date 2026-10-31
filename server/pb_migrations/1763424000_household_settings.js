/// <reference path="../pb_data/types.d.ts" />

// Settings for the whole household, in one record. For now just the
// country, which decides the grocery stores Bento offers ("AU", "US", or
// "OTHER" for anywhere Bento doesn't know stores yet). Anyone logged in can
// change it on the Household page.
//
// A Bento that already has accounts was set up when only Australian stores
// existed, so it starts as Australia. A brand-new one starts empty, and the
// app fills it in from the first browser that logs in (see web/src/country.ts).

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';
  const settings = new Collection({
    type: "base",
    name: "household_settings",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    fields: [
      { name: "country", type: "text", max: 10 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(settings);

  const users = app.countRecords("users");
  if (users > 0) {
    const record = new Record(settings);
    record.set("country", "AU");
    app.save(record);
  }
}, (app) => {
  app.delete(app.findCollectionByNameOrId("household_settings"));
});

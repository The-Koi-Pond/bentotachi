/// <reference path="../pb_data/types.d.ts" />

// For brand-new Bento servers (friends running their own): a placeholder
// admin account, so PocketBase skips its own first-start page. That page
// opens at http://0.0.0.0:8090/..., which Windows browsers can't show, so a
// new server would greet people with a broken page on every start. Bento's
// setup screen turns this placeholder into the real admin account (see
// pb_hooks/household.pb.js). Servers that already have an admin are left alone.

const PLACEHOLDER = "admin@bento.local";

migrate((app) => {
  const superusers = app.findCollectionByNameOrId("_superusers");
  const existing = app.findAllRecords(superusers).filter((r) => r.getString("email") !== "__pbinstaller@example.com");
  if (existing.length > 0) return;
  const admin = new Record(superusers);
  admin.setEmail(PLACEHOLDER);
  admin.setPassword($security.randomString(40));
  app.save(admin);
}, (app) => {
  try {
    app.delete(app.findAuthRecordByEmail("_superusers", PLACEHOLDER));
  } catch {
    // Already turned into a real admin, or never made.
  }
});

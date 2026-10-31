/// <reference path="../pb_data/types.d.ts" />

// Setting up a brand-new Bento server (for friends running their own).
// Adding more household members afterwards happens in the app (any member
// can add someone; see the users_household migration).

// Whether this server still needs setting up: no household accounts yet.
routerAdd("GET", "/api/cookbook/setup", (e) => {
  return e.json(200, { needsSetup: e.app.countRecords("users") === 0 });
});

// First-time setup: creates the first household account, and makes the
// server's admin account (for its admin page, /_/) use the same password,
// with the email "<username>@bento.local". Only works while there are no
// household accounts at all.
routerAdd("POST", "/api/cookbook/setup", (e) => {
  const body = e.requestInfo().body;
  const username = String(body.username ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const adminEmail = `${username}@bento.local`;

  e.app.runInTransaction((txApp) => {
    // Checked inside the transaction, so two people setting up at the same
    // moment can't both get in.
    if (txApp.countRecords("users") > 0) {
      throw new BadRequestError("This Bentotachi is already set up. Log in instead.");
    }
    const user = new Record(txApp.findCollectionByNameOrId("users"));
    user.set("username", username);
    user.set("name", name);
    user.setPassword(password);
    // Checks the username and password rules (lowercase, length).
    try {
      txApp.save(user);
    } catch {
      throw new BadRequestError(
        "Check your username and password. Usernames are 2 to 30 lowercase letters, numbers, dots, dashes or underscores, and passwords need at least 8 characters."
      );
    }

    // The placeholder admin from the setup_admin migration, if it's still
    // there; otherwise a new admin account.
    const superusers = txApp.findCollectionByNameOrId("_superusers");
    let admin;
    try {
      admin = txApp.findAuthRecordByEmail(superusers, "admin@bento.local");
    } catch {
      admin = new Record(superusers);
    }
    admin.setEmail(adminEmail);
    admin.setPassword(password);
    txApp.save(admin);
  });

  return e.json(200, { adminEmail });
});

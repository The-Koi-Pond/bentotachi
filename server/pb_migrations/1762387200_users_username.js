/// <reference path="../pb_data/types.d.ts" />

// Log in with a username instead of an email. Email becomes optional (it
// still works for logging in, so nobody is locked out). Existing accounts
// get a username made from their name, or from their email if they have no
// name; it can be changed in the admin dashboard.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // 1. Add the field without rules yet, because existing accounts are blank.
  users.fields.add(new TextField({ name: "username", max: 30, pattern: "^[a-z0-9._-]*$", presentable: true }));
  app.save(users);

  // 2. Give every existing account a username, avoiding clashes.
  const taken = {};
  const records = app.findAllRecords("users");
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const source = record.getString("name") || record.getString("email").split("@")[0];
    let base = source.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 26);
    if (base.length < 2) base = "user";
    let username = base;
    for (let n = 2; taken[username]; n++) username = base + n;
    taken[username] = true;
    record.set("username", username);
    app.save(record);
  }

  // 3. Now require it, keep it unique, use it for logging in, and stop
  //    requiring an email.
  const updated = app.findCollectionByNameOrId("users");
  const field = updated.fields.getByName("username");
  field.required = true;
  field.min = 2;
  field.pattern = "^[a-z0-9._-]+$";
  updated.addIndex("idx_users_username", true, "username", "");
  updated.passwordAuth.identityFields = ["username", "email"];
  updated.fields.getByName("email").required = false;
  app.save(updated);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth.identityFields = ["email"];
  users.fields.getByName("email").required = true;
  users.removeIndex("idx_users_username");
  users.fields.removeByName("username");
  app.save(users);
});

/// <reference path="../pb_data/types.d.ts" />

// Household members can add each other (the Household page in the app),
// so nobody needs the admin page to make an account. Logged-out visitors
// still can't sign up.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.createRule = '@request.auth.id != "" && @request.auth.collectionName = "users"';
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.createRule = null;
  app.save(users);
});

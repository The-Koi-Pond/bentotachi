/// <reference path="../pb_data/types.d.ts" />

// Adding up the same thing on the shopping list (docs/PLAN.md, "Next up:
// from a tester's report"): a line two recipes need ("5 garlic cloves")
// keeps each recipe's share here, as a list of { recipe, title, text }
// (web/src/shoppingAddUp.ts), shown behind the line's book button. The
// `recipe` relation stays the first share's recipe, for older apps.

migrate((app) => {
  const items = app.findCollectionByNameOrId("shopping_items");
  items.fields.add(new JSONField({ name: "shares", maxSize: 20000 }));
  app.save(items);
}, (app) => {
  const items = app.findCollectionByNameOrId("shopping_items");
  items.fields.removeByName("shares");
  app.save(items);
});

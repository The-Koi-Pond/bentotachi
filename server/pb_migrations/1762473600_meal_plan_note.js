/// <reference path="../pb_data/types.d.ts" />

// A night on the plan can hold a short note ("Take-away night") instead of
// a recipe. pb_hooks/meal_plan.pb.js makes sure each night has one or the
// other.

migrate((app) => {
  const plan = app.findCollectionByNameOrId("meal_plan");
  plan.fields.getByName("recipe").required = false;
  plan.fields.add(new TextField({ name: "note", max: 100 }));
  app.save(plan);
}, (app) => {
  // Notes-only nights can't exist once a recipe is required again.
  app.db().newQuery("DELETE FROM meal_plan WHERE recipe = ''").execute();
  const plan = app.findCollectionByNameOrId("meal_plan");
  plan.fields.removeByName("note");
  plan.fields.getByName("recipe").required = true;
  app.save(plan);
});

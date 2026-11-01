/// <reference path="../pb_data/types.d.ts" />

// Breakfast and lunch on the plan, not just dinner. Each plan entry now
// says which meal it is, and a day holds one of each instead of one in all.
// Everything already planned was a dinner. An app from before this sends no
// meal, which pb_hooks/meal_plan.pb.js counts as dinner.
//
// The household chooses which meals its plan shows (Household page); none
// chosen means dinner only, as before.

migrate((app) => {
  const plan = app.findCollectionByNameOrId("meal_plan");
  plan.fields.add(new SelectField({ name: "meal", values: ["breakfast", "lunch", "dinner"], maxSelect: 1 }));
  plan.indexes = ["CREATE UNIQUE INDEX idx_meal_plan_date_meal ON meal_plan (date, meal)"];
  app.save(plan);
  app.db().newQuery("UPDATE meal_plan SET meal = 'dinner' WHERE meal = ''").execute();

  const settings = app.findCollectionByNameOrId("household_settings");
  settings.fields.add(new SelectField({ name: "plan_meals", values: ["breakfast", "lunch", "dinner"], maxSelect: 3 }));
  app.save(settings);
}, (app) => {
  // Back to one dinner per day: breakfasts and lunches can't stay.
  app.db().newQuery("DELETE FROM meal_plan WHERE meal != 'dinner'").execute();
  const plan = app.findCollectionByNameOrId("meal_plan");
  plan.indexes = [];
  app.save(plan);
  plan.fields.removeByName("meal");
  plan.indexes = ["CREATE UNIQUE INDEX idx_meal_plan_date ON meal_plan (date)"];
  app.save(plan);

  const settings = app.findCollectionByNameOrId("household_settings");
  settings.fields.removeByName("plan_meals");
  app.save(settings);
});

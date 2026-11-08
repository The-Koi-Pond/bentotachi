/// <reference path="../pb_data/types.d.ts" />

// More than one dish per meal: a main with its sides, or a curry with its
// rice. A meal's place (its day and meal) was
// unique; now it can hold several entries, shown in the order they were
// added. Nothing already planned changes.
//
// An app from before this shows one dish per place (whichever it reads
// last) and its Plan button replaces the first; nothing is lost.

migrate((app) => {
  const plan = app.findCollectionByNameOrId("meal_plan");
  plan.indexes = ["CREATE INDEX idx_meal_plan_date_meal ON meal_plan (date, meal)"];
  app.save(plan);
}, (app) => {
  // Back to one dish per place: only the first added in each stays.
  app
    .db()
    .newQuery(
      "DELETE FROM meal_plan WHERE id NOT IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY date, meal ORDER BY created, id) AS n FROM meal_plan) WHERE n = 1)"
    )
    .execute();
  const plan = app.findCollectionByNameOrId("meal_plan");
  plan.indexes = ["CREATE UNIQUE INDEX idx_meal_plan_date_meal ON meal_plan (date, meal)"];
  app.save(plan);
});

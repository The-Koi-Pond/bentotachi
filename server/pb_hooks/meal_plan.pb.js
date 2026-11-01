/// <reference path="../pb_data/types.d.ts" />

// Every meal on the plan needs a recipe or a note (or both), so blank ones
// can't be saved. One without a meal comes from an app made before
// breakfast and lunch existed, so it's a dinner.
onRecordValidate((e) => {
  if (!e.record.getString("meal")) e.record.set("meal", "dinner");
  const recipe = e.record.getString("recipe");
  const note = e.record.getString("note").trim();
  if (!recipe && !note) {
    throw new BadRequestError("Choose a recipe or write a note for this meal.");
  }
  e.next();
}, "meal_plan");

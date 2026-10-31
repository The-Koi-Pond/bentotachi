/// <reference path="../pb_data/types.d.ts" />

// Every night on the dinner plan needs a recipe or a note (or both), so
// blank nights can't be saved.
onRecordValidate((e) => {
  const recipe = e.record.getString("recipe");
  const note = e.record.getString("note").trim();
  if (!recipe && !note) {
    throw new BadRequestError("Choose a recipe or write a note for this night.");
  }
  e.next();
}, "meal_plan");

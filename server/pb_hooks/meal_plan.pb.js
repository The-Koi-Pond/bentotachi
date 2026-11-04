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

// POST /api/cookbook/meal-plan/swap { a, b }: two planned meals trade what
// they hold (recipe and note), each staying in its own place. Both are saved
// together or not at all, so a dropped connection can't leave the same meal
// in both places and the other one lost (MealPlan.tsx move).
routerAdd("POST", "/api/cookbook/meal-plan/swap", (e) => {
  const body = e.requestInfo().body;
  const ids = [String(body.a ?? ""), String(body.b ?? "")];
  if (!ids[0] || !ids[1] || ids[0] === ids[1]) throw new BadRequestError("Choose two different meals to swap.");

  e.app.runInTransaction((txApp) => {
    const [a, b] = ids.map((id) => {
      try {
        return txApp.findRecordById("meal_plan", id);
      } catch {
        // Not a 404: the app reads 404 as a server too old for this route.
        throw new BadRequestError("One of those meals isn't on the plan any more (someone may have just removed it), so nothing was swapped.");
      }
    });
    const aRecipe = a.getString("recipe");
    const aNote = a.getString("note");
    a.set("recipe", b.getString("recipe"));
    a.set("note", b.getString("note"));
    b.set("recipe", aRecipe);
    b.set("note", aNote);
    txApp.save(a);
    txApp.save(b);
  });

  return e.json(200, { swapped: ids });
}, $apis.requireAuth());

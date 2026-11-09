// Deleting recipes: one from its own page, or several picked in the Recipes
// page's Edit mode. The server deletes each recipe's plan nights, cooked
// days and ratings with it, so the question counts them first.
import { cookedLog, mealPlan, pb, recipeRatings, recipes, type Recipe } from "./pb";
import { deleteQuestion } from "./deleteWarning";
import { forEveryone } from "./household";
import { askFirst } from "./askFirst";

export async function confirmDelete(list: Pick<Recipe, "id" | "title">[], singleUser: boolean): Promise<boolean> {
  if (!list.length) return false;
  // "recipe = {:r0} || recipe = {:r1} …": what goes with any of them.
  const params = Object.fromEntries(list.map((recipe, i) => [`r${i}`, recipe.id]));
  const filter = pb.filter(list.map((_, i) => `recipe = {:r${i}}`).join(" || "), params);
  const options = { filter, fields: "id" };
  const total = (page: Promise<{ totalItems: number }>) => page.then((p) => p.totalItems);
  let extras = null;
  try {
    const [planned, cooked, ratings] = await Promise.all([
      total(mealPlan().getList(1, 1, options)),
      total(cookedLog().getList(1, 1, options)),
      total(recipeRatings().getList(1, 1, options)),
    ]);
    extras = { planned, cooked, ratings };
  } catch {
    // Couldn't count: the question still warns it can't be undone.
  }
  return askFirst(deleteQuestion(list.map((recipe) => recipe.title), extras, forEveryone(singleUser)), {
    yes: "Delete",
    danger: true,
  });
}

// Deletes them one by one; says which went and which couldn't.
export async function deleteRecipes(list: Pick<Recipe, "id" | "title">[]) {
  const deleted: string[] = [];
  const failed: { title: string; reason: unknown }[] = [];
  for (const recipe of list) {
    try {
      await recipes().delete(recipe.id);
      deleted.push(recipe.id);
    } catch (reason) {
      failed.push({ title: recipe.title, reason });
    }
  }
  return { deleted, failed };
}

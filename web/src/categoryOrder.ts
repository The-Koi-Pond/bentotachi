import { recipeCategories, type RecipeCategory } from "./pb";

// Saves the shelves' order (dragging a shelf in the Recipes page's Edit
// mode), numbered 0, 1, 2… Only the ones whose number
// changed are sent. For everyone in the household.
export async function saveCategoryOrder(order: RecipeCategory[], before: RecipeCategory[]): Promise<RecipeCategory[]> {
  const was = new Map(before.map((category) => [category.id, category.position]));
  return Promise.all(
    order.map((category, position) =>
      was.get(category.id) === position ? { ...category, position } : recipeCategories().update(category.id, { position }),
    ),
  );
}

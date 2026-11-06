// Which recipes are on which shelf of the Recipes page. A recipe is in a
// category when it has any of the category's tags (ignoring capitals and
// spaces at the ends); it can be on several shelves. Recipes on none go on
// "Everything else".

// The "Everything else" shelf's id (for remembering it's closed).
export const OTHER = "other";

interface Tagged {
  tags: string[] | null;
}

interface Category {
  id: string;
  name: string;
  tags: string[] | null;
  position: number;
}

export function normaliseTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function inCategory(recipe: Tagged, category: Pick<Category, "tags">): boolean {
  const wanted = new Set((category.tags ?? []).map(normaliseTag));
  return (recipe.tags ?? []).some((tag) => wanted.has(normaliseTag(tag)));
}

// A recipe's tags once it's put on a shelf: the shelf's first tag added,
// unless the recipe is on it already (or the shelf has no tags to add).
export function puttingOn(tags: string[] | null, category: Pick<Category, "tags">): string[] {
  const list = tags ?? [];
  const first = category.tags?.[0];
  if (!first || inCategory({ tags: list }, category)) return list;
  return [...list, normaliseTag(first)];
}

// A recipe's tags once it's taken off a shelf: every tag that counts for
// the shelf removed, so it really leaves it. (Any of them kept would keep
// it on the shelf, so a tag another shelf shares goes too, and the recipe
// leaves that shelf as well: the Recipes page says so and offers Undo.)
export function takingOff(tags: string[] | null, category: Pick<Category, "tags">): string[] {
  const gone = new Set((category.tags ?? []).map(normaliseTag));
  return (tags ?? []).filter((tag) => !gone.has(normaliseTag(tag)));
}

export function sortCategories<C extends Category>(categories: C[]): C[] {
  return [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

// The list with one category moved to where another one is (dragging a
// shelf onto another: it takes that one's place), numbered 0, 1, 2… again.
// Unchanged if either isn't in the list.
export function movedTo<C extends Category>(categories: C[], fromId: string, toId: string): C[] {
  const order = sortCategories(categories);
  const from = order.findIndex((c) => c.id === fromId);
  const to = order.findIndex((c) => c.id === toId);
  if (from < 0 || to < 0 || from === to) return order;
  const [moving] = order.splice(from, 1);
  order.splice(to, 0, moving);
  return order.map((category, position) => ({ ...category, position }));
}

// Every shelf in order, then "Everything else" (left out when it's empty).
// The recipes keep the order they're given in.
export function shelves<R extends Tagged, C extends Category>(recipes: R[], categories: C[]) {
  const list: { id: string; name: string; category: C | null; recipes: R[] }[] = sortCategories(categories).map((category) => ({
    id: category.id,
    name: category.name,
    category,
    recipes: recipes.filter((recipe) => inCategory(recipe, category)),
  }));
  const rest = recipes.filter((recipe) => !categories.some((category) => inCategory(recipe, category)));
  if (rest.length) list.push({ id: OTHER, name: "Everything else", category: null, recipes: rest });
  return list;
}

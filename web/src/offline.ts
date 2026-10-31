// Offline reading: each time recipes load, the phone keeps a copy (text only,
// no photos), so they can still be read without a connection, e.g. in a
// shop with no signal. Only reading works offline; changes need the server.

import type { Recipe, RecipeRating } from "./pb";

const RECIPES_KEY = "bento.offline.recipes";
const RATINGS_KEY = "bento.offline.ratings";

function read<T>(key: string): T[] | null {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T[]) : null;
  } catch {
    return null;
  }
}

function write(key: string, list: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Phone storage full or blocked: offline reading just stays out of date.
  }
}

// The copy keeps what recipe pages and the list need: the recipe, and who
// added it (name and color only, for "Added by"), without other extras.
function plain(recipe: Recipe): Recipe {
  const { expand, ...rest } = recipe;
  const by = expand?.added_by;
  if (!by) return rest as Recipe;
  const { id, collectionId, collectionName, name, username, color } = by;
  return { ...rest, expand: { added_by: { id, collectionId, collectionName, name, username, color } } } as Recipe;
}

export function saveRecipes(list: Recipe[]) {
  write(RECIPES_KEY, list.map(plain));
}

// Keeps one recipe's copy up to date (after opening or editing it).
export function saveRecipe(recipe: Recipe) {
  const list = read<Recipe>(RECIPES_KEY) ?? [];
  write(RECIPES_KEY, [...list.filter((r) => r.id !== recipe.id), plain(recipe)]);
}

export function savedRecipes(): Recipe[] | null {
  return read<Recipe>(RECIPES_KEY);
}

export function saveRatings(list: RecipeRating[]) {
  write(RATINGS_KEY, list);
}

export function savedRatings(): RecipeRating[] {
  return read<RecipeRating>(RATINGS_KEY) ?? [];
}

// "Can't reach the server" (no connection, or the server is off), as
// opposed to the server answering with an error.
export function isOffline(err: unknown): boolean {
  return (err as { status?: number })?.status === 0;
}

// Logging out forgets the copy, so the next person on this phone doesn't see it.
export function forgetOfflineCopy() {
  try {
    localStorage.removeItem(RECIPES_KEY);
    localStorage.removeItem(RATINGS_KEY);
  } catch {
    // Nothing to forget.
  }
}

// Offline use: each time recipes load, the phone keeps a copy (text only,
// no photos), so they can still be read without a connection, e.g. in a
// shop with no signal. The shopping list (and the pantry items it shows
// brands from) is kept the same way, and can be ticked off and added to
// offline (see offlineShopping.ts). Other changes need the server.

import type { Recipe, RecipeRating } from "./pb";
import { remember, rememberedJson } from "./phoneStorage.ts";

const RECIPES_KEY = "bento.offline.recipes";
const RATINGS_KEY = "bento.offline.ratings";
// Copies kept by useLiveRecords (see its offlineKey).
export const SHOPPING_KEY = "bento.offline.shopping";
export const PANTRY_KEY = "bento.offline.pantry";
// Shopping list changes made offline, waiting to be sent.
export const SHOPPING_QUEUE_KEY = "bento.offline.shoppingQueue";

export function read<T>(key: string): T[] | null {
  const saved = rememberedJson(key);
  return Array.isArray(saved) ? (saved as T[]) : null;
}

// Phone storage full or blocked: offline reading just stays out of date.
export function write(key: string, list: unknown[]) {
  remember(key, JSON.stringify(list));
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

// Logging out forgets the copy (and unsent list changes), so the next person
// on this phone doesn't see them.
// keepWaiting: leave shopping list changes made offline that haven't been
// sent yet, for when the login merely expired; they go once someone logs
// in again (the list is the household's).
export function forgetOfflineCopy({ keepWaiting = false } = {}) {
  const keys = [RECIPES_KEY, RATINGS_KEY, SHOPPING_KEY, PANTRY_KEY, ...(keepWaiting ? [] : [SHOPPING_QUEUE_KEY])];
  for (const key of keys) remember(key, null);
}

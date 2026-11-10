// Offline use: each time recipes load, the phone keeps a copy (text only,
// no photos), so they can still be read without a connection, e.g. in a
// shop with no signal. The shopping list (and the pantry items it shows
// brands from) is kept the same way, and can be ticked off and added to
// offline (see offlineShopping.ts). Other changes need the server.

import type { PantryItem, Recipe, RecipeRating, ShoppingItem } from "./pb";
import { statusOf } from "./errorStatus.ts";
import { remember, rememberedJson } from "./phoneStorage.ts";

const RECIPES_KEY = "bento.offline.recipes";
const RATINGS_KEY = "bento.offline.ratings";
const SHOPPING_KEY = "bento.offline.shopping";
const PANTRY_KEY = "bento.offline.pantry";
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

// A list's copy, as useLiveRecords keeps it.
export interface OfflineCopy<T> {
  read(): T[] | null;
  write(list: T[]): void;
}

// keep: trims each record to what's worth keeping.
function copyAt<T>(key: string, keep?: (item: T) => T): OfflineCopy<T> {
  return { read: () => read<T>(key), write: (list) => write(key, keep ? list.map(keep) : list) };
}

export const recipesCopy = copyAt<Recipe>(RECIPES_KEY, plain);
export const ratingsCopy = copyAt<RecipeRating>(RATINGS_KEY);
export const shoppingCopy = copyAt<ShoppingItem>(SHOPPING_KEY);
export const pantryCopy = copyAt<PantryItem>(PANTRY_KEY);

// Keeps one recipe's copy up to date (after opening or editing it).
export function saveRecipe(recipe: Recipe) {
  const list = read<Recipe>(RECIPES_KEY) ?? [];
  write(RECIPES_KEY, [...list.filter((r) => r.id !== recipe.id), plain(recipe)]);
}

export function savedRecipes(): Recipe[] | null {
  return read<Recipe>(RECIPES_KEY);
}

// "Can't reach the server" (no connection, or the server is off), as
// opposed to the server answering with an error.
export function isOffline(err: unknown): boolean {
  return statusOf(err) === 0;
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

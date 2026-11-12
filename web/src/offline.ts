// Offline use: each time a list loads, the phone keeps a copy (text only,
// no photos), so it can still be read without a connection, e.g. in a
// shop with no signal: recipes, ratings, shelves, the shopping list, the
// pantry and its packets, the plan, what was cooked and the fridge door.
// The shopping list can also be ticked off and added to offline (see
// offlineShopping.ts). Other changes need the server.

import type {
  CookedEntry,
  MealPlanEntry,
  Note,
  PantryItem,
  PantryPacket,
  Recipe,
  RecipeCategory,
  RecipeRating,
  ShoppingItem,
  ShoppingList,
  User,
} from "./pb";
import { statusOf } from "./errorStatus.ts";
import { remember, rememberedJson } from "./phoneStorage.ts";

const RECIPES_KEY = "bento.offline.recipes";
const RATINGS_KEY = "bento.offline.ratings";
const SHOPPING_KEY = "bento.offline.shopping";
const LISTS_KEY = "bento.offline.shoppingLists";
const PANTRY_KEY = "bento.offline.pantry";
const PACKETS_KEY = "bento.offline.packets";
const SHELVES_KEY = "bento.offline.shelves";
const PLAN_KEY = "bento.offline.plan";
const COOKED_KEY = "bento.offline.cooked";
const NOTES_KEY = "bento.offline.notes";
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

// Who added something, as a copy keeps them: their name and colour only
// (for "Added by" and a fridge note's paper), nothing else of theirs.
function person({ id, collectionId, collectionName, name, username, color }: User): User {
  return { id, collectionId, collectionName, name, username, color } as User;
}

// The copy keeps what recipe pages and the list need: the recipe, and who
// added it, without other extras.
function plain(recipe: Recipe): Recipe {
  const { expand, ...rest } = recipe;
  const by = expand?.added_by;
  return (by ? { ...rest, expand: { added_by: person(by) } } : rest) as Recipe;
}

function plainNote(note: Note): Note {
  const { expand, ...rest } = note;
  const by = expand?.added_by;
  return (by ? { ...rest, expand: { added_by: person(by) } } : rest) as Note;
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

// The same copy for a page that loads the list in another shape (without
// what the main page expands): it shows the copy offline but never writes
// it, which would drop what the main page needs from it.
function readOnly<T>(copy: OfflineCopy<T>): OfflineCopy<T> {
  return { read: copy.read, write: () => {} };
}

export const recipesCopy = copyAt<Recipe>(RECIPES_KEY, plain);
export const ratingsCopy = copyAt<RecipeRating>(RATINGS_KEY);
export const shelvesCopy = copyAt<RecipeCategory>(SHELVES_KEY);
export const shoppingCopy = copyAt<ShoppingItem>(SHOPPING_KEY);
export const shoppingListsCopy = copyAt<ShoppingList>(LISTS_KEY);
export const pantryCopy = copyAt<PantryItem>(PANTRY_KEY);
export const packetsCopy = copyAt<PantryPacket>(PACKETS_KEY);
export const cookedCopy = copyAt<CookedEntry>(COOKED_KEY);
// Loaded with who wrote each note (expand: "added_by").
export const notesCopy = copyAt<Note>(NOTES_KEY, plainNote);

// The plan's copy leaves out its recipes, which the recipes' copy already
// holds in full (the week's shopping needs their ingredients), and puts them
// back when read. A recipe not in that copy shows as the plan's note does.
export const planCopy: OfflineCopy<MealPlanEntry> = {
  read() {
    const plan = read<MealPlanEntry>(PLAN_KEY);
    if (!plan) return null;
    const recipes = new Map((read<Recipe>(RECIPES_KEY) ?? []).map((recipe) => [recipe.id, recipe]));
    return plan.map((entry) => {
      const recipe = entry.recipe ? recipes.get(entry.recipe) : undefined;
      return recipe ? { ...entry, expand: { recipe } } : entry;
    });
  },
  write(list) {
    write(
      PLAN_KEY,
      list.map(({ expand: _left, ...entry }) => entry)
    );
  },
};

// For the pages that load these lists in another shape (see readOnly).
export const planCopyReadOnly = readOnly(planCopy);
export const notesCopyReadOnly = readOnly(notesCopy);
export const shoppingCopyReadOnly = readOnly(shoppingCopy);

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
  const keys = [
    RECIPES_KEY,
    RATINGS_KEY,
    SHELVES_KEY,
    SHOPPING_KEY,
    LISTS_KEY,
    PANTRY_KEY,
    PACKETS_KEY,
    PLAN_KEY,
    COOKED_KEY,
    NOTES_KEY,
    ...(keepWaiting ? [] : [SHOPPING_QUEUE_KEY]),
  ];
  for (const key of keys) remember(key, null);
}

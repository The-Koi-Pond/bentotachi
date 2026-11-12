import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";
import { Capacitor } from "@capacitor/core";
import { useMemo, useSyncExternalStore, type CSSProperties } from "react";
import { DEFAULT_QUICK_MINUTES } from "./format";
import { remember, remembered } from "./phoneStorage";
import { forgetOfflineCopy } from "./offline";
import { keepPhotos } from "./photoCache";
import { isServerAnswer } from "./loginGuard";
import { viaTailscale } from "./tailscale.ts";
import { connection, requestFetch } from "./connection.ts";

// In a browser, Bento is served by PocketBase itself, so it talks to "/"
// (in development Vite forwards that to PocketBase). The Android app carries
// its own copy of Bento, so it needs the server's address: typed in on the
// login screen and remembered on the phone.
export const isAndroidApp = Capacitor.isNativePlatform();
const SERVER_URL_KEY = "bento.serverUrl";

export function savedServerUrl(): string {
  return remembered(SERVER_URL_KEY) ?? "";
}

// "192.168.1.20:8090/" -> "http://192.168.1.20:8090"
export function normaliseServerUrl(input: string): string {
  const url = input.trim().replace(/\/+$/, "");
  return url && !/^https?:\/\//i.test(url) ? `http://${url}` : url;
}

export function setServerUrl(url: string) {
  pb.baseURL = url;
  remember(SERVER_URL_KEY, url);
}

export const pb = new PocketBase(isAndroidApp ? savedServerUrl() : "/");
// Allow overlapping requests (e.g. typing fast in search) instead of the
// library cancelling earlier ones.
pb.autoCancellation(false);
// An answer that isn't the server's (a Wi-Fi sign-in page in its place)
// counts as no connection (status 0), like everywhere offline is handled:
// lists show the phone's copy and keep it, and shopping changes wait.
// Otherwise its page reads as an empty list (wiping that copy) and every
// save as done.
// A load with no answer starting in time counts as offline too, rather than
// leaving a page on "Loading…" for minutes (answerTimeout.ts), and every
// request tells the connection indicator how it went (connection.ts).
pb.beforeSend = (url, options) => ({ url, options: { ...options, fetch: requestFetch(url, options, connection) } });
connection.setCheck(() => pb.health.check({ cache: "no-store" }));
pb.afterSend = (response, data) => {
  if (!isServerAnswer(response.status, response.headers.get("content-type"), response.headers.get("content-length"))) {
    throw new ClientResponseError({ url: response.url, status: 0, response: { message: "That wasn't Bentotachi's server answering." } });
  }
  return data;
};

// Logged out: the phone's offline copies go too, so the next person on it
// doesn't see them (offline.ts). keepWaiting: shopping list changes not
// sent yet stay, for when the login merely expired; they go once someone
// logs in again.
export function logOut({ keepWaiting = false } = {}) {
  forgetOfflineCopy({ keepWaiting });
  // Kept photos too (photoCache.ts), unless the login merely expired.
  if (!keepWaiting) void keepPhotos(false);
  pb.authStore.clear();
}

export interface User extends RecordModel {
  // What they log in with, like "xel" (lowercase, unique).
  username: string;
  // Optional, and hidden from everyone else by the server.
  email: string;
  name: string;
  // Their "quick recipe" limit in minutes; 0 means the default (30).
  quick_minutes: number;
  // Their color, like "#7048e8"; "" means Bentotachi's usual plum (the accent).
  color: string;
  // Their profile picture's file name, or "" for none (see Avatar.tsx).
  avatar: string;
  // Whether recipes show their nutrition facts to them (Settings'
  // "Show nutrition"; off unless they turn it on).
  show_nutrition?: boolean;
  // "Bring step photos" from websites (import.pb.js). Missing from a login
  // an older app version saved on the phone.
  website_step_photos?: boolean;
  updated: string;
}

export interface Recipe extends RecordModel {
  title: string;
  description: string;
  source_url: string;
  image: string;
  // How the photo is framed ({ x, y, zoom }; see photoFraming.ts), or null.
  image_framing: unknown;
  servings: string;
  prep_minutes: number;
  cook_minutes: number;
  total_minutes: number;
  // Named times besides prep and cook, like [{ label: "Cool", minutes: 420 }]
  // (see extraTimes in format.ts).
  extra_times: unknown;
  ingredients: string[] | null;
  steps: string[] | null;
  // Chosen pantry links for ingredient lines (see pantryLinks.ts).
  ingredient_links: Record<string, string> | null;
  tags: string[] | null;
  notes: string;
  // The recipe writer's own tips from the original page; "notes" are ours.
  author_notes: string;
  // The website's own rating when it was imported from a link: out of 5
  // (0 = none) and how many gave it. Missing from offline copies older app
  // versions saved.
  site_rating?: number;
  site_rating_count?: number;
  // Nutrition facts per serving, a line each ("Calories: 420 kcal"),
  // shown to people who turn on "Show nutrition". Missing from offline
  // copies older app versions saved.
  nutrition?: string[] | null;
  // Photos besides the cover (file names), and which step each goes with
  // (see recipePhotos.ts). Missing from offline copies older app versions
  // saved, and from lists that load only some fields.
  photos?: string[];
  photo_steps?: Record<string, string> | null;
  added_by: string;
  created: string;
  updated: string;
  expand?: { added_by?: User };
}

export const recipes = () => pb.collection<Recipe>("recipes");

export interface ShoppingItem extends RecordModel {
  text: string;
  checked: boolean;
  recipe: string;
  pantry_item: string;
  // Its list; "" (older apps, the server's "ran out" add) is the main one.
  list: string;
  added_by: string;
  created: string;
  updated: string;
  expand?: { recipe?: Recipe };
}

export const shoppingItems = () => pb.collection<ShoppingItem>("shopping_items");

// One of the household's shopping lists; the main one can't be deleted.
export interface ShoppingList extends RecordModel {
  name: string;
  main: boolean;
  added_by: string;
  created: string;
  updated: string;
}

export const shoppingLists = () => pb.collection<ShoppingList>("shopping_lists");

export type PantryStatus = "have" | "low" | "out";

// One product a pantry item's household buys: "Nutella 400 g", its barcodes
// and its pages in online stores. Brand and size are "" until known.
export interface PantryProduct {
  brand: string;
  size: string;
  barcodes: string[];
  links: string[];
}

export interface PantryItem extends RecordModel {
  name: string;
  status: PantryStatus;
  location: string;
  subcategory: string;
  // "2026-11-02 00:00:00.000Z", or "" for no date. See expiry.ts. Its own
  // when nobody counts it, else its labels' soonest, kept by the server
  // (pb_hooks/pantry_labels.js).
  expires: string;
  // Its product page in an online store (see stores.ts), or "": the first
  // of its store links. More of them (another store's page) are in
  // more_store_urls; read both with storeLinksOf in pantryItem.ts.
  store_url: string;
  more_store_urls?: string[] | null;
  // The favourite brand, the one to look for when shopping, like "Lea &
  // Perrins", or "". Apps before packets (1.15.0 and older) called it "Brands
  // we buy", so older items may list several: "Coles, White Mill" (see
  // brandsOf in pantryItem.ts).
  brand: string;
  // Barcodes on its packets, like ["9300633603161"] (see barcodes.ts).
  barcodes: string[] | null;
  // What each barcode's packet is, once known: {"9300633603161": {"brand":
  // "White Mill", "size": "1 kg"}} (see pantryPackets.ts).
  barcode_details?: Record<string, { brand?: string; size?: string }> | null;
  // The group it's a kind of ("Pasta" for Linguine), or "" (see
  // pantryLinks.ts and the pantry_kind_of migration).
  kind_of?: string;
  // The favourite product's brand and size: what "+ 1 more" and the shopping
  // list add (pantry_usual_packet migration). Only a person changes it once
  // set (server/pb_hooks/pantry.pb.js).
  usual_packet?: { brand?: string; size?: string } | null;
  // The products the household buys (pantry_products migration; see
  // pantryProducts.ts). barcodes, store_url and more_store_urls are kept
  // from them by the server, so this app saves products, not those.
  products?: PantryProduct[] | null;
  // Someone has given it, or one of its labels, a use-by date: after a
  // scan the app offers "+ Use-by".
  dates_used?: boolean;
  // Anything worth writing down, like "3 cans", or "".
  note?: string;
  // Its photo's file name, or "" (see pantryPhoto.ts and pantryPhotoUrl).
  photo?: string;
  // The barcodes and store links last looked up online for its photo, so
  // they aren't tried again (see photoSources in pantryItem.ts); "removed"
  // once someone removed its photo (never looked up by itself again); or "".
  // Named from when only store links were.
  photo_link_tried?: string;
  created: string;
  updated: string;
}

export const pantryItems = () => pb.collection<PantryItem>("pantry_items");

// One bag, jar or can of a pantry item actually in stock (see the
// pantry_packets migration and pantryPackets.ts). Any field may be "".
export interface PantryPacket extends RecordModel {
  item: string;
  brand: string;
  size: string;
  barcode: string;
  // The shopping item whose tick added it, or "" (pantry_usual_packet
  // migration).
  bought_with?: string;
  // What's left once cooking used part of it ("100 g"), or "" when it's full
  // (pantry_packets_left migration).
  left?: string;
  // Its own use-by date, and the day it was opened ("" while sealed), as
  // PocketBase dates (pantry_packets_dates migration). The item's use-by is
  // the soonest of them, kept by the server (pb_hooks/pantry_labels.js).
  expires?: string;
  opened?: string;
  // The day it was bought, when someone said; otherwise it's the day it was
  // added (boughtDay, pantryPackets.ts).
  bought?: string;
  created: string;
}

export const pantryPackets = () => pb.collection<PantryPacket>("pantry_packets");

// One meal on the plan: a recipe, or a short note like "Take-away night"
// instead. date: "2026-11-02 00:00:00.000Z" (see dates.ts).
export interface MealPlanEntry extends RecordModel {
  date: string;
  // "breakfast", "lunch" or "dinner" (see meals.ts); empty before meals
  // existed, which means dinner.
  meal?: string;
  recipe: string;
  note: string;
  added_by: string;
  expand?: { recipe?: Recipe };
}

export const mealPlan = () => pb.collection<MealPlanEntry>("meal_plan");

// "We cooked this": a day a recipe was cooked (see cookHistory.ts).
// date: "2026-11-02 00:00:00.000Z".
export interface CookedEntry extends RecordModel {
  date: string;
  recipe: string;
  cooked_by: string;
  created: string;
}

export const cookedLog = () => pb.collection<CookedEntry>("cooked");

// One person's take on one recipe. stars: 0 means not rated.
export interface RecipeRating extends RecordModel {
  recipe: string;
  user: string;
  stars: number;
  favorite: boolean;
  // Thumbs up. A thumbs down ("disliked") is the other choice; never both.
  approved: boolean;
  disliked: boolean;
  // Why they don't like it, as short tags like "baked pineapple".
  dislike_reasons: string[] | null;
  expand?: { user?: User };
}

export const recipeRatings = () => pb.collection<RecipeRating>("recipe_ratings");

// One of the household's own recipe sites on the Browse tab.
export interface SavedSite extends RecordModel {
  name: string;
  url: string;
  added_by: string;
  created: string;
}

export const savedSites = () => pb.collection<SavedSite>("saved_sites");

// A note on the fridge door (pages/Fridge.tsx), for everyone in the household.
export interface Note extends RecordModel {
  text: string;
  added_by: string;
  created: string;
  expand?: { added_by?: User };
}

export const notes = () => pb.collection<Note>("notes");

// A shelf on the Recipes page: recipes with any of these (lowercase) tags.
export interface RecipeCategory extends RecordModel {
  name: string;
  tags: string[] | null;
  // Shelves are shown smallest first.
  position: number;
}

export const recipeCategories = () => pb.collection<RecipeCategory>("recipe_categories");

export const users = () => pb.collection<User>("users");

// Their profile picture's address, or "" if they haven't added one.
export function avatarUrl(user: User): string {
  return user.avatar ? pb.files.getURL(user, user.avatar) : "";
}

// Their name, or their username if no name is set.
export function displayName(user: Pick<User, "name" | "username"> | undefined): string {
  return user?.name || user?.username || "Someone";
}

// The swatches offered in the settings menu: mid-tones that stay readable
// on both the light and dark backgrounds.
export const PERSON_COLORS = [
  { name: "Pink", value: "#d6336c" },
  { name: "Grape", value: "#ae3ec9" },
  { name: "Violet", value: "#7048e8" },
  { name: "Blue", value: "#1c7ed6" },
  { name: "Teal", value: "#0c8599" },
  { name: "Green", value: "#2f9e44" },
  { name: "Amber", value: "#e67700" },
  { name: "Red", value: "#e03131" },
];

// Style that gives an element (and what's inside it) a person's color, used
// by CSS as var(--person). Without a color, CSS falls back to the accent (plum).
export function personStyle(user: Pick<User, "color"> | undefined): CSSProperties | undefined {
  return user?.color ? ({ "--person": user.color } as CSSProperties) : undefined;
}

// Average of the people who gave stars, e.g. 4.3; null if nobody has.
export function averageStars(ratings: RecipeRating[]): number | null {
  const rated = ratings.filter((r) => r.stars > 0);
  if (rated.length === 0) return null;
  return Math.round((rated.reduce((sum, r) => sum + r.stars, 0) / rated.length) * 10) / 10;
}

export function recipeImageUrl(recipe: Recipe, thumb?: string): string {
  if (!recipe.image) return "";
  return pb.files.getURL(recipe, recipe.image, thumb ? { thumb } : undefined);
}

// One of a recipe's other photos (recipePhotos.ts), whole or as the
// 600-wide copy ("600x0").
export function recipePhotoUrl(recipe: Recipe, name: string, thumb?: string): string {
  return pb.files.getURL(recipe, name, thumb ? { thumb } : undefined);
}

// A pantry item's photo, as the small copy that keeps the whole packet in
// view (see the pantry_photo migration), or "" if it has none.
export function pantryPhotoUrl(item: PantryItem): string {
  return item.photo ? pb.files.getURL(item, item.photo, { thumb: "160x160f" }) : "";
}

function subscribeToAuth(onChange: () => void) {
  return pb.authStore.onChange(onChange);
}

// The logged-in household member, or null. Re-renders on login/logout and
// when they change their own settings. Watches a plain-text key (the token
// plus when the account last changed) rather than the user record itself,
// because the library hands out a fresh copy of the record on every read,
// which React would treat as a change every time and re-render forever.
export function useCurrentUser(): User | null {
  const key = useSyncExternalStore(
    subscribeToAuth,
    () => `${pb.authStore.token}|${(pb.authStore.record as User | null)?.updated ?? ""}`
  );
  return useMemo(
    () => (pb.authStore.token && pb.authStore.isValid ? (pb.authStore.record as User) : null),
    // On purpose: `key` is what changes; the record itself is read fresh
    // each time, so the rule can't see why it's listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );
}

// Your "quick recipe" limit in minutes.
export function useQuickMinutes(): number {
  return useCurrentUser()?.quick_minutes || DEFAULT_QUICK_MINUTES;
}

// Turns a server error into a sentence worth showing to a person.
export function errorMessage(err: unknown): string {
  const e = err as {
    status?: number;
    message?: string;
    response?: { message?: string; data?: Record<string, { message?: string }> };
  };
  if (e.status === 0)
    return viaTailscale(isAndroidApp ? pb.baseURL : window.location.href)
      ? "Can't reach the Bentotachi server. It goes through Tailscale, so check this phone's Tailscale is switched on."
      : "Can't reach the Bentotachi server. Is it running, and are you connected?";
  // Rejected fields come back separately ("name: Value must be unique."),
  // and are more useful than the general "Failed to create record."
  const field = Object.entries(e.response?.data ?? {}).find(([, detail]) => detail?.message);
  if (field) return `${e.response?.message ?? "Couldn't save"} (${field[0]}: ${field[1].message})`;
  return e.response?.message || e.message || "Something went wrong.";
}

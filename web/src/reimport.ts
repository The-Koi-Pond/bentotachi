// "Re-import from the website" (a recipe's ⋯): what the site's current
// version changes in a saved recipe. The site's parts are replaced; the
// household's own stay: the name, notes, ratings, photos and tags (the
// site's are added), with pantry links and step photos carried to the new
// wording as when editing. What the site no longer gives stays as it was.

import { carriedLinks } from "./pantryLinks.ts";
import { carriedStepPhotos } from "./recipePhotos.ts";

// What the import route's preview sends back (recipe_parse.js fitRecipe).
export interface SiteRecipe {
  title?: string;
  description?: string;
  servings?: string;
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  ingredients?: string[];
  steps?: string[];
  tags?: string[];
  authorNotes?: string;
  nutrition?: string[];
  siteRating?: { value: number; count: number } | null;
}

// The saved recipe as read just before re-importing.
export interface SavedParts {
  ingredients?: string[] | null;
  steps?: string[] | null;
  ingredient_links?: Record<string, string> | null;
  photo_steps?: Record<string, string> | null;
  photos?: string[];
  tags?: string[] | null;
}

const lines = (list: string[] | undefined) => (list && list.length ? list : undefined);

export function reimportChanges(now: SavedParts, site: SiteRecipe): Record<string, unknown> {
  const ingredients = lines(site.ingredients) ?? now.ingredients ?? [];
  const steps = lines(site.steps) ?? now.steps ?? [];
  const data: Record<string, unknown> = {
    ingredients,
    steps,
    ingredient_links: carriedLinks(now.ingredients ?? [], ingredients, now.ingredient_links),
    tags: [...new Set([...(now.tags ?? []), ...(site.tags ?? [])])],
    photo_steps: carriedStepPhotos(now.steps, steps, now.photo_steps, now.photos),
  };
  if (site.description) data.description = site.description;
  if (site.servings) data.servings = site.servings;
  if (site.prepMinutes) data.prep_minutes = site.prepMinutes;
  if (site.cookMinutes) data.cook_minutes = site.cookMinutes;
  if (site.totalMinutes) data.total_minutes = site.totalMinutes;
  if (site.authorNotes) data.author_notes = site.authorNotes;
  if (lines(site.nutrition)) data.nutrition = site.nutrition;
  if (site.siteRating) {
    data.site_rating = site.siteRating.value;
    data.site_rating_count = site.siteRating.count;
  }
  return data;
}

// Whether the site's recipe looks like a different one from the saved
// recipe (a link that now leads elsewhere): no word of the saved name in
// the site's, ignoring small words. A renamed recipe usually still shares
// one ("Our butter chicken" and "One-pan Baked Butter Chicken").
export function looksDifferent(savedTitle: string, siteTitle: string | undefined): boolean {
  const words = (title: string) =>
    new Set(
      title
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 2 && !SMALL.has(word))
    );
  if (!siteTitle) return false;
  const site = words(siteTitle);
  const saved = [...words(savedTitle)];
  return saved.length > 0 && site.size > 0 && !saved.some((word) => site.has(word));
}

const SMALL = new Set("the and with our my your best easy quick one pan recipe for from".split(" "));

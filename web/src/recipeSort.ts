// The orders the Recipes tab can show recipes in.

import { totalMinutes } from "./format.ts";

export const SORTS = [
  { value: "title", label: "A–Z" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
  { value: "quickest", label: "Quickest" },
] as const;

export type SortOrder = (typeof SORTS)[number]["value"];

type Sortable = {
  id: string;
  title: string;
  created: string;
  prep_minutes: number;
  cook_minutes: number;
  total_minutes: number;
};

const byTitle = (a: Sortable, b: Sortable) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

// Recipes without stars or a time go last; ties go A–Z. `score` gives a
// recipe's average stars (or null) and how many thumbs up it has.
export function sortRecipes<T extends Sortable>(
  list: T[],
  order: SortOrder,
  score: (recipe: T) => { stars: number | null; thumbs: number }
): T[] {
  const sorted = [...list];
  if (order === "title") return sorted.sort(byTitle);
  if (order === "newest") return sorted.sort((a, b) => b.created.localeCompare(a.created) || byTitle(a, b));
  if (order === "quickest") {
    const minutes = (r: T) => totalMinutes(r) || Infinity;
    return sorted.sort((a, b) => minutes(a) - minutes(b) || byTitle(a, b));
  }
  const scores = new Map(list.map((r) => [r.id, score(r)]));
  return sorted.sort((a, b) => {
    const x = scores.get(a.id)!;
    const y = scores.get(b.id)!;
    return (y.stars ?? -1) - (x.stars ?? -1) || y.thumbs - x.thumbs || byTitle(a, b);
  });
}

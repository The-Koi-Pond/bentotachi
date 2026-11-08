// The fridge door's rules (pages/Fridge.tsx, and the title's note count in
// App.tsx), kept here so the tests can reach them.
import { addDays, datePart, storedTime } from "./dates.ts";
import { mealOf, mealWord, type Meal } from "./meals.ts";
import type { Note } from "./pb";

// One shows at the top of the fridge door, a new one each visit. Add more
// freely: one line each. Garnish only: never the place for information
// (docs/VISION.md, Voice).
export const SPLASH_LINES = [
  "For the fifth time, yes, we need onions.",
  "Your fridge is not a reliable historian.",
  "For when “what's for dinner?” becomes a group project.",
  "Dinner plans for people who have other plans.",
  "For everyone who shares a fridge.",
  "The whole household fits in this lunchbox.",
  "Tidy little compartments for your untidy kitchen life.",
  "Ben handles the screaming. You handle dinner.",
  "Ben would like to know what's for dinner.",
  "Even Ben can't scream the groceries into existence.",
  "Your food stays yours. Ben remains very loud.",
  "Free, private, and only slightly screaming.",
  "Know what you've got before buying a fourth jar of cumin.",
];

export function randomSplash(random = Math.random): string {
  return SPLASH_LINES[Math.floor(random() * SPLASH_LINES.length)];
}

// Notes someone else posted since this phone last opened the fridge door.
// lastSeen is the newest note's `created` when it was last opened (the
// server's clock, so a phone's wrong clock can't hide or repeat notes); ""
// if never.
export function unreadNotes(all: Pick<Note, "added_by" | "created">[], me: string | undefined, lastSeen: string): number {
  return all.filter((note) => note.added_by !== me && note.created > lastSeen).length;
}

export function newestCreated(all: Pick<Note, "created">[]): string {
  return all.reduce((newest, note) => (note.created > newest ? note.created : newest), "");
}

// How old a note (or a happening) is: "just now", "20 min ago", "3 h ago",
// "yesterday", "4 days ago", then the date. created is the server's
// "2026-11-04 03:13:06.123Z".
export function noteAge(created: string, now: Date): string {
  const then = storedTime(created);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (Number.isNaN(minutes)) return "";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60 && then.getDate() === now.getDate()) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// "3 of the next 7 dinners are planned", counting from today, for the meals
// the household plans.
export function planSummary(entries: { date: string; meal?: string }[], today: string, meals: Meal[]): string {
  const end = addDays(today, 7);
  // Places planned, not dishes: a dinner with two sides is one dinner.
  const planned = new Set(
    entries
      .filter((entry) => {
        const date = datePart(entry.date);
        return date >= today && date < end && meals.includes(mealOf(entry));
      })
      .map((entry) => `${datePart(entry.date)}|${mealOf(entry)}`)
  ).size;
  const total = 7 * meals.length;
  const word = mealWord(meals);
  if (planned === 0) return `Nothing planned for the next 7 days yet.`;
  if (planned >= total) return `Every ${word} for the next 7 days is planned.`;
  return `${planned} of the next ${total} ${word}s ${planned === 1 ? "is" : "are"} planned.`;
}

// "milk, onions and 3 more"
export function shortList(names: string[], shown = 4): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (sorted.length <= shown) return joinNames(sorted);
  return `${sorted.slice(0, shown).join(", ")} and ${sorted.length - shown} more`;
}

function joinNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

// The "Lately" list: recipes added and recipes cooked, newest first.
export interface Happening {
  kind: "added" | "cooked";
  id: string;
  when: string;
  who: string;
  recipeId: string;
  title: string;
}

export function happenings(
  added: { id: string; created: string; added_by: string; title: string }[],
  cooked: { id: string; created: string; cooked_by: string; recipe: string; title: string }[],
  limit = 8
): Happening[] {
  return [
    ...added.map((r): Happening => ({ kind: "added", id: r.id, when: r.created, who: r.added_by, recipeId: r.id, title: r.title })),
    ...cooked.map((c): Happening => ({ kind: "cooked", id: c.id, when: c.created, who: c.cooked_by, recipeId: c.recipe, title: c.title })),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, limit);
}

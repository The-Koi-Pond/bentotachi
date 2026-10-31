// Ingredients and steps are stored as lists of lines. A line starting with
// "#" is a heading, e.g. "# For the sauce".

// Tick-boxes that recipe sites put in front of each ingredient, which come
// along when a list is copied: "▢ 2 eggs" -> "2 eggs".
const LEADING_TICK_BOXES = /^(?:[▢☐□◻◽❏❐☑☒✓✔]\s*)+/;

export function textToLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().replace(LEADING_TICK_BOXES, "").trim())
    .filter(Boolean);
}

export function linesToText(lines: string[] | null | undefined): string {
  return (lines ?? []).join("\n");
}

export function headingOf(line: string): string | null {
  return line.startsWith("#") ? line.replace(/^#+\s*/, "") : null;
}

// In a method, a "# Sauce" heading is a separate part of the dish: its steps
// count from 1 again. A "## Cook the vegetables" heading carries on from the
// steps before it.
export function continuesNumbering(line: string): boolean {
  return line.startsWith("##");
}

export function textToTags(text: string): string[] {
  const tags = text
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

// An extra named time on a recipe besides prep and cook: "Cool" 420,
// "Release" 10.
export interface ExtraTime {
  label: string;
  minutes: number;
}

// A recipe's extra times, leaving out blank or broken ones.
export function extraTimes(recipe: { extra_times?: unknown }): ExtraTime[] {
  if (!Array.isArray(recipe.extra_times)) return [];
  return recipe.extra_times.filter(
    (time): time is ExtraTime =>
      !!time && typeof time.label === "string" && time.label.trim() !== "" && typeof time.minutes === "number" && time.minutes > 0,
  );
}

// Many sites (and people typing by hand) give prep and cook times but no
// total, so fall back to adding those up, with any extra times (a recipe's
// own total is kept as it is).
export function totalMinutes(recipe: { prep_minutes: number; cook_minutes: number; total_minutes: number; extra_times?: unknown }): number {
  if (recipe.total_minutes) return recipe.total_minutes;
  return recipe.prep_minutes + recipe.cook_minutes + extraTimes(recipe).reduce((sum, time) => sum + time.minutes, 0);
}

// A recipe is "quick" if its total time is at or under the person's limit.
// Recipes with no time filled in are never quick.
export const DEFAULT_QUICK_MINUTES = 30;

export function isQuick(
  recipe: { prep_minutes: number; cook_minutes: number; total_minutes: number },
  limit: number
): boolean {
  const minutes = totalMinutes(recipe);
  return minutes > 0 && minutes <= limit;
}

// 75 -> "1 h 15 min"
export function formatMinutes(minutes: number): string {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

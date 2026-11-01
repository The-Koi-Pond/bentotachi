// Breakfast, lunch and dinner on the plan. Each plan entry is one meal on
// one day; the household chooses which meals its plan shows (Household
// page), and none chosen means dinner only. Entries from before meals
// existed have no meal and are dinners.

export type Meal = "breakfast" | "lunch" | "dinner";

export const MEALS: Meal[] = ["breakfast", "lunch", "dinner"];

export const MEAL_NAMES: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export function mealOf(entry: { meal?: string }): Meal {
  return MEALS.find((meal) => meal === entry.meal) ?? "dinner";
}

// The household's choice in plan order; dinner alone if it chose nothing.
export function plannedMeals(chosen: readonly string[] | null | undefined): Meal[] {
  const meals = MEALS.filter((meal) => chosen?.includes(meal));
  return meals.length ? meals : ["dinner"];
}

// The meals a day shows: the household's, plus any meal it already has
// planned (so turning lunch off doesn't hide a lunch that's on the plan).
export function mealsForDay(chosen: Meal[], has: (meal: Meal) => boolean): Meal[] {
  return MEALS.filter((meal) => chosen.includes(meal) || has(meal));
}

// One meal on one day, as an id for dragging and dropping: "2026-11-02|lunch".
export function slotKey(date: string, meal: Meal): string {
  return `${date}|${meal}`;
}

export function parseSlot(key: string): { date: string; meal: Meal } {
  const [date, meal = ""] = key.split("|");
  return { date, meal: mealOf({ meal }) };
}

// "Dinner plan" while it's dinner only, otherwise "Meal plan".
export function planTitle(meals: Meal[]): string {
  return meals.length === 1 ? `${MEAL_NAMES[meals[0]]} plan` : "Meal plan";
}

// "dinner", "lunch", or "meal" when the plan has more than one kind.
export function mealWord(meals: Meal[]): string {
  return meals.length === 1 ? meals[0] : "meal";
}

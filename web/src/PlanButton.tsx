import { useState, type FormEvent } from "react";
import { statusOf } from "./errorStatus";
import { Link } from "react-router";
import { errorMessage, mealPlan, pb, type Recipe } from "./pb";
import { formatDay, localToday, toStoredDate } from "./dates";
import { CalendarIcon } from "./icons";
import DateField from "./DateField";
import { usePlanMeals } from "./household";
import { MEAL_NAMES, type Meal } from "./meals";

// "📅 Plan" on a recipe page: pick a day (and, when the plan has more than
// dinner, which meal) and put this recipe on the plan, alongside anything
// already planned for that meal.
export default function PlanButton({ recipe }: { recipe: Recipe }) {
  const [meals] = usePlanMeals();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(localToday);
  // null: the plan's usual meal (dinner, or the last of the household's).
  const [chosenMeal, setChosenMeal] = useState<Meal | null>(null);
  const meal = chosenMeal && meals.includes(chosenMeal) ? chosenMeal : meals[meals.length - 1];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [planned, setPlanned] = useState<{ date: string; meal: Meal } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!date) return;
    setBusy(true);
    setError("");
    try {
      // Already planned there: nothing to do. Something else planned there:
      // this goes alongside it, as a meal can hold more than one recipe
      // (it used to ask to replace it).
      const already = await mealPlan()
        .getFirstListItem(pb.filter("date = {:date} && meal = {:meal} && recipe = {:recipe}", { date: toStoredDate(date), meal, recipe: recipe.id }))
        .catch((err) => {
          if (statusOf(err) === 404) return null;
          throw err;
        });
      if (!already) {
        await mealPlan().create({ date: toStoredDate(date), meal, recipe: recipe.id, added_by: pb.authStore.record?.id });
      }
      setPlanned({ date, meal });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="button small" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <CalendarIcon size={18} />
        Plan
      </button>
      {(open || planned || error) && (
        <div className="plan-popup">
          {open && (
            <form className="add-row" onSubmit={submit}>
              <DateField label="Day to cook it" value={date} onChange={setDate} required />
              {meals.length > 1 && (
                <select value={meal} onChange={(e) => setChosenMeal(e.target.value as Meal)} aria-label="Which meal">
                  {meals.map((m) => (
                    <option key={m} value={m}>
                      {MEAL_NAMES[m]}
                    </option>
                  ))}
                </select>
              )}
              <button className="button primary small" disabled={busy}>
                {busy ? "Adding…" : "Add to plan"}
              </button>
            </form>
          )}
          {planned && !open && (
            <p className="success">
              Planned for {meals.length > 1 ? `${planned.meal} on ` : ""}
              {formatDay(planned.date)}. <Link to="/plan">See the plan</Link>
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </>
  );
}

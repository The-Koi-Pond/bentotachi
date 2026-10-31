import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, mealPlan, pb, type Recipe } from "./pb";
import { formatDay, localToday, toStoredDate } from "./dates";
import { CalendarIcon } from "./icons";

// "📅 Plan" on a recipe page: pick a night and put this recipe on the
// dinner plan. If that night already has a dinner, ask before replacing it.
export default function PlanButton({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(localToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [planned, setPlanned] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!date) return;
    setBusy(true);
    setError("");
    try {
      const existing = await mealPlan()
        .getFirstListItem(pb.filter("date = {:date}", { date: toStoredDate(date) }), { expand: "recipe" })
        .catch((err) => {
          if ((err as { status?: number }).status === 404) return null;
          throw err;
        });
      if (existing && existing.recipe !== recipe.id) {
        const current = existing.expand?.recipe?.title || existing.note || "another dinner";
        if (!window.confirm(`${formatDay(date)} already has “${current}”. Replace it with this?`)) {
          setBusy(false);
          return;
        }
        // A note night ("Take-away") becomes this recipe's night.
        await mealPlan().update(existing.id, { recipe: recipe.id, note: "" });
      } else if (!existing) {
        await mealPlan().create({ date: toStoredDate(date), recipe: recipe.id, added_by: pb.authStore.record?.id });
      }
      setPlanned(date);
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
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Night to cook it"
                required
              />
              <button className="button primary small" disabled={busy}>
                {busy ? "Adding…" : "Add to plan"}
              </button>
            </form>
          )}
          {planned && !open && (
            <p className="success">
              Planned for {formatDay(planned)}. <Link to="/plan">See the plan</Link>
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </>
  );
}

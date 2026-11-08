import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { errorMessage, type MealPlanEntry, type PantryItem, type PantryPacket, type Recipe } from "./pb";
import { addDays, datePart, formatDay } from "./dates";
import { gatherIngredients } from "./weekShopping";
import { addToShoppingList, addedMessage } from "./shoppingAdd";
import { useLiveRecords } from "./useLiveRecords";
import { CloseIcon } from "./icons";
import { MEALS, mealOf } from "./meals";
import { GatheredList, useGatheredTicks } from "./GatheredTicks";

const RANGES = [7, 14];

// "Add these to the shopping list" after the plan: gathers the ingredients of the meals planned from today
// on into one list, merged and with what we have unticked, and adds the
// ticked ones to the shopping list.
export default function WeekShoppingSheet({
  entries,
  today,
  word,
  onClose,
}: {
  entries: MealPlanEntry[];
  today: string;
  // "dinner", or "meal" when the plan has more than dinners (meals.ts).
  word: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const packets = useLiveRecords<PantryPacket>("pantry_packets");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const last = addDays(today, days - 1);
  const dinners = entries
    .filter((entry) => {
      const date = datePart(entry.date);
      return date >= today && date <= last && entry.expand?.recipe;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(mealOf(a)) - MEALS.indexOf(mealOf(b)));
  const rows = gatherIngredients(
    dinners.map((entry) => entry.expand!.recipe as Recipe),
    pantry.items ?? [],
    packets.items ?? []
  );

  const ticks = useGatheredTicks(rows);
  const ticked = ticks.ticked;

  async function add() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await addToShoppingList(
        ticked.map((row) => ({ text: row.text, pantryItem: row.pantryItem?.id ?? "", recipe: row.recipeId }))
      );
      setStatus({ text: addedMessage(result), isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy(false);
    }
  }

  // Packets too, or an Add in the first instant would take full amounts.
  // Packets that can't load fall back to Have / Low / Out.
  const loading = !pantry.items || ticks.loading || (!packets.items && !packets.loadError);

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="week-shop-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="sheet-panel">
        <div className="sheet-head">
          <h2 id="week-shop-title">Shop for the planned {word}s</h2>
          <button className="icon-button small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="filter-chips" role="group" aria-label={`Which ${word}s`}>
          {RANGES.map((count) => (
            <button key={count} aria-pressed={days === count} onClick={() => setDays(count)}>
              Next {count} days
            </button>
          ))}
        </div>
        <p className="muted week-dinners">
          {dinners.length === 0
            ? "No recipes planned in these days."
            : dinners
                .map((entry) => `${entry.expand!.recipe!.title} (${formatDay(datePart(entry.date), { weekday: "short", day: "numeric" })})`)
                .join(", ")}
        </p>

        {loading && <p className="muted">Checking the pantry…</p>}
        {(pantry.loadError || ticks.loadError) && <p className="error">{pantry.loadError || ticks.loadError}</p>}

        {!loading && rows.length > 0 && (
          <>
            <p className="muted week-dinners">Things the pantry says we have start unticked.</p>
            <GatheredList rows={rows} ticks={ticks} showFor />
          </>
        )}

        <div className="actions">
          <button className="button primary" disabled={busy || ticked.length === 0} onClick={add}>
            {busy ? "Adding…" : ticked.length ? `Add ${ticked.length} to shopping list` : "Add to shopping list"}
          </button>
        </div>
        {status && (
          <p className={status.isError ? "error" : "success"} role="status">
            {status.text} {!status.isError && <Link to="/shopping">Open the list</Link>}
          </p>
        )}
      </div>
    </dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { errorMessage, type MealPlanEntry, type PantryItem, type Recipe, type ShoppingItem } from "./pb";
import { addDays, datePart, formatDay } from "./dates";
import { gatherIngredients, startsTicked, type GatheredRow } from "./weekShopping";
import { addToShoppingList, addedMessage } from "./shoppingAdd";
import { useLiveRecords } from "./useLiveRecords";
import { CloseIcon } from "./icons";
import { MEALS, mealOf } from "./meals";

const STATUS_WORDS = { have: "Have", low: "Low", out: "Out" } as const;
const RANGES = [7, 14];

// "Shop for these": gathers the ingredients of the meals planned from today
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
  const shopping = useLiveRecords<ShoppingItem>("shopping_items");
  const [days, setDays] = useState(7);
  // Ticks people changed by hand; everything else uses the starting tick.
  const [ticks, setTicks] = useState<Map<string, boolean>>(new Map());
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
    pantry.items ?? []
  );

  // What's already waiting on the shopping list, by pantry link or name.
  const waiting = (shopping.items ?? []).filter((item) => !item.checked);
  const onList = (row: GatheredRow) =>
    waiting.some(
      (item) =>
        (row.pantryItem && item.pantry_item === row.pantryItem.id) ||
        item.text.trim().toLowerCase() === row.text.toLowerCase()
    );
  const isTicked = (row: GatheredRow) => !onList(row) && (ticks.get(row.key) ?? startsTicked(row));
  const ticked = rows.filter(isTicked);

  function toggle(row: GatheredRow) {
    setTicks((previous) => new Map(previous).set(row.key, !isTicked(row)));
  }

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

  const loading = !pantry.items || !shopping.items;

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
        {(pantry.loadError || shopping.loadError) && <p className="error">{pantry.loadError || shopping.loadError}</p>}

        {!loading && rows.length > 0 && (
          <>
            <p className="muted week-dinners">Things the pantry says we have start unticked.</p>
            <ul className="checklist week-list">
              {rows.map((row) => {
                const already = onList(row);
                const status = row.pantryItem?.status;
                return (
                  <li key={row.key}>
                    <label className={already ? "done" : ""}>
                      <input type="checkbox" checked={isTicked(row)} disabled={already} onChange={() => toggle(row)} />
                      <span className="week-row-text">
                        <span>{row.text}</span>
                        <span className="muted week-row-for">for {row.recipeTitles.join(", ")}</span>
                      </span>
                      {already ? (
                        <span className="muted week-row-state">On the list</span>
                      ) : (
                        status && (
                          <span className={`week-row-state status-${status}`}>
                            <span className={`status-dot status-${status}`} aria-hidden="true" />
                            {STATUS_WORDS[status]}
                          </span>
                        )
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
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

import { useState } from "react";
import type { ShoppingItem } from "./pb";
import { rowStatus, startsTicked, type GatheredRow } from "./weekShopping";
import { useLiveRecords } from "./useLiveRecords";
import { sameThing } from "./shoppingMatch";
import { coverNote } from "./pantryStock";

const STATUS_WORDS = { have: "Have", low: "Low", out: "Out" } as const;

// Ticking gathered ingredients (weekShopping.ts) to add to the shopping
// list: what the pantry says we have starts unticked, and what's already
// waiting on the list can't be added twice. Used by the plan's "Add these
// to the shopping list" and the list's "From a recipe".
export function useGatheredTicks(rows: GatheredRow[]) {
  const shopping = useLiveRecords<ShoppingItem>("shopping_items");
  // Ticks people changed by hand; everything else uses the starting tick.
  const [ticks, setTicks] = useState<Map<string, boolean>>(new Map());

  const waiting = (shopping.items ?? []).filter((item) => !item.checked);
  const onList = (row: GatheredRow) =>
    waiting.some((item) => sameThing({ text: row.text, pantryItem: row.pantryItem?.id ?? "" }, item));
  const isTicked = (row: GatheredRow) => !onList(row) && (ticks.get(row.key) ?? startsTicked(row));

  return {
    loading: !shopping.items,
    loadError: shopping.loadError,
    onList,
    isTicked,
    ticked: rows.filter(isTicked),
    toggle: (row: GatheredRow) => setTicks((previous) => new Map(previous).set(row.key, !isTicked(row))),
    // "All" or "Missing from pantry".
    tickAll: () => setTicks(new Map(rows.map((row) => [row.key, true]))),
    tickMissing: () => setTicks(new Map()),
  };
}

export function GatheredList({
  rows,
  ticks,
  showFor,
}: {
  rows: GatheredRow[];
  ticks: ReturnType<typeof useGatheredTicks>;
  // "for Curry, Rice" under each, when several recipes are gathered.
  showFor: boolean;
}) {
  return (
    <ul className="checklist week-list">
      {rows.map((row) => {
        const already = ticks.onList(row);
        const status = rowStatus(row) ?? undefined;
        // "Enough: 2 × 500 g" or "Have 200 g" when the packets can tell,
        // instead of Have / Low / Out.
        const note = coverNote(row.cover, status ? { status } : null);
        const noteStatus = row.cover.kind === "enough" && status !== "low" ? "have" : "low";
        return (
          <li key={row.key}>
            <label className={already ? "done" : ""}>
              <input type="checkbox" checked={ticks.isTicked(row)} disabled={already} onChange={() => ticks.toggle(row)} />
              <span className="week-row-text">
                <span>{row.text}</span>
                {showFor && <span className="muted week-row-for">for {row.recipeTitles.join(", ")}</span>}
              </span>
              {already ? (
                <span className="muted week-row-state">On the list</span>
              ) : note ? (
                <span className={`week-row-state status-${noteStatus}`}>
                  <span className={`status-dot status-${noteStatus}`} aria-hidden="true" />
                  {note}
                </span>
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
  );
}

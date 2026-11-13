import { useState } from "react";
import type { ShoppingItem, ShoppingList } from "./pb";
import type { ToList } from "./shoppingAdd";
import { rowsOn, waitingElsewhere } from "./shoppingLists";
import { rowStatus, startsTicked, type GatheredRow } from "./weekShopping";
import { useLiveRecords } from "./useLiveRecords";
import { shoppingCopyReadOnly } from "./offline";
import { plannedAdds, sharesOf } from "./shoppingAddUp";
import { coverNote } from "./pantryStock";

const STATUS_WORDS = { have: "Have", low: "Low", out: "Out" } as const;

// Ticking gathered ingredients (weekShopping.ts) to add to a shopping list
// (`to`): what the pantry says we have starts unticked, what's already
// waiting on that list can't be added twice, and what's waiting on another
// list ("On Party") starts unticked, to tick if it's wanted here too. Used
// by the plan's "Add these to the shopping list" and the list's "From a
// recipe".
export function useGatheredTicks(rows: GatheredRow[], to: ToList, lists: Pick<ShoppingList, "id" | "name" | "main" | "created">[]) {
  const shopping = useLiveRecords<ShoppingItem>("shopping_items", { copy: shoppingCopyReadOnly });
  // Ticks people changed by hand; everything else uses the starting tick.
  const [ticks, setTicks] = useState<Map<string, boolean>>(new Map());

  const all = shopping.items ?? [];
  const waiting = rowsOn(all, to.list || to.mainId, to.mainId)
    .filter((item) => !item.checked)
    .map((item) => ({ id: item.id, text: item.text, pantryItem: item.pantry_item, shares: sharesOf(item) }));
  const thing = (row: GatheredRow) => ({ text: row.text, pantryItem: row.pantryItem?.id ?? "" });
  // On the list already for these recipes: adding it would change nothing
  // (plannedAdds). Another recipe's "3 carrots" can still be ticked, and
  // adds up.
  const onList = (row: GatheredRow) => plannedAdds([{ ...thing(row), shares: row.shares }], waiting).steps.length === 0;
  // The other list it's waiting on, by name, or "".
  const elsewhere = (row: GatheredRow) => waitingElsewhere(thing(row), all, to.list || to.mainId, lists)?.name ?? "";
  const isTicked = (row: GatheredRow) => !onList(row) && (ticks.get(row.key) ?? (startsTicked(row) && !elsewhere(row)));

  return {
    loading: !shopping.items,
    loadError: shopping.loadError,
    onList,
    elsewhere,
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
        const otherList = already ? "" : ticks.elsewhere(row);
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
              ) : otherList ? (
                <span className="muted week-row-state">On {otherList}</span>
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

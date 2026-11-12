// The household's several shopping lists (docs/PLAN.md, "several shopping
// lists"): which list a row is on, the list last open on this phone, and
// where else something already waits. A row with no list is on the main one
// (older apps; the server's "ran out" add). Tested in
// web/test/shoppingLists.test.ts.
import type { ShoppingItem, ShoppingList } from "./pb";
import { remember, remembered } from "./phoneStorage.ts";
import { sameThing } from "./shoppingMatch.ts";

type Listed = Pick<ShoppingList, "id" | "name" | "main" | "created">;
type Row = Pick<ShoppingItem, "text" | "pantry_item" | "list" | "checked">;

const OPEN_KEY = "bento.shoppingList";

// The main list first, then the others in the order they were made.
export function orderedLists<T extends Listed>(lists: T[]): T[] {
  return [...lists].sort((a, b) => Number(b.main) - Number(a.main) || a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
}

// The main list's id ("" before the lists have loaded).
export function mainListId(lists: Listed[]): string {
  return orderedLists(lists)[0]?.id ?? "";
}

// The list a row is on.
export const listOf = (row: Pick<ShoppingItem, "list">, mainId: string) => row.list || mainId;

// What a new row saves as its list: "" for the main one, as older apps and
// the server's "ran out" add save it, so the main list's rows are found
// even before the lists have loaded (and its id isn't known yet).
export const storedList = (listId: string, mainId: string) => (listId === mainId ? "" : listId);

// The rows on one list.
export function rowsOn<T extends Pick<ShoppingItem, "list">>(rows: T[], listId: string, mainId: string): T[] {
  return rows.filter((row) => listOf(row, mainId) === listId);
}

// The list to show: the one last open on this phone while it's still
// there, else the main one.
export function openList(lists: Listed[]): string {
  const saved = remembered(OPEN_KEY);
  return saved && lists.some((list) => list.id === saved) ? saved : mainListId(lists);
}

export function rememberOpenList(listId: string, lists: Listed[]) {
  remember(OPEN_KEY, listId === mainListId(lists) ? null : listId);
}

// "Party · 4 to buy", for the list menu: how many still to buy on each.
export function toBuyOn(rows: Row[], listId: string, mainId: string): number {
  return rowsOn(rows, listId, mainId).filter((row) => !row.checked).length;
}

// The other list where this thing already waits (not ticked), or null: so
// adding it here can ask first ("Milk is already on Party. Add it here
// too?"), and a recipe's line can say "On Party".
export function waitingElsewhere<T extends Listed>(
  thing: { text: string; pantryItem: string },
  rows: Row[],
  listId: string,
  lists: T[]
): T | null {
  const mainId = mainListId(lists);
  const row = rows.find((r) => !r.checked && listOf(r, mainId) !== listId && sameThing(thing, r));
  return row ? (lists.find((list) => list.id === listOf(row, mainId)) ?? null) : null;
}

import { pb, shoppingItems } from "./pb";
import { newToTheList, sameThing } from "./shoppingMatch";
import { listOf, rowsOn, storedList } from "./shoppingLists";

export interface ToBuy {
  text: string;
  // The pantry item it's for, or "" (linked, buying it marks it as Have).
  pantryItem: string;
  // The recipe it's for, or "".
  recipe: string;
}

// Which shopping list to add to: its id ("" for the main one, as a row with
// no list is on it) and the main list's id, to tell its rows.
export interface ToList {
  list: string;
  mainId: string;
}

// Adds things to a shopping list in order, skipping anything already
// waiting on that list (newToTheList), so nothing gets doubled up and trying
// again after an error is safe.
export async function addToShoppingList(things: ToBuy[], { list, mainId }: ToList): Promise<Added> {
  const all: { text: string; pantry_item: string; list: string }[] = await shoppingItems().getFullList({
    filter: "checked = false",
    fields: "text,pantry_item,list",
  });
  const here = list || mainId;
  const fresh = newToTheList(things, rowsOn(all, here, mainId));
  const elsewhere = all.filter((row) => listOf(row, mainId) !== here);
  const alsoElsewhere = fresh.filter((thing) => elsewhere.some((row) => sameThing(thing, row))).length;
  for (const thing of fresh) {
    // One at a time, so the list keeps this order.
    await shoppingItems().create({
      text: thing.text.trim(),
      checked: false,
      recipe: thing.recipe,
      pantry_item: thing.pantryItem,
      list: storedList(here, mainId),
      added_by: pb.authStore.record?.id,
    });
  }
  return { added: fresh.length, skipped: things.length - fresh.length, alsoElsewhere };
}

// How it went: how many added, how many were on that list already, and how
// many of those added wait on another list too.
export interface Added {
  added: number;
  skipped: number;
  alsoElsewhere: number;
}

// "Added 3 items to the shopping list. 1 was already on it.", or "to Party"
// when the household has several lists, and "1 is on another list too."
export function addedMessage({ added, skipped, alsoElsewhere }: Added, listName = ""): string {
  return (
    `Added ${added} ${added === 1 ? "item" : "items"} to ${listName || "the shopping list"}.` +
    (skipped ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already on it.` : "") +
    (alsoElsewhere ? ` ${alsoElsewhere} ${alsoElsewhere === 1 ? "is" : "are"} on another list too.` : "")
  );
}

import { pb, shoppingItems, type ShoppingItem } from "./pb";
import { sameThing } from "./shoppingMatch";
import { listOf, rowsOn, storedList } from "./shoppingLists";
import { plannedAdds, sharesOf, type Thing } from "./shoppingAddUp";

// Which shopping list to add to: its id ("" for the main one, as a row with
// no list is on it) and the main list's id, to tell its rows.
export interface ToList {
  list: string;
  mainId: string;
}

// Adds things to a shopping list in order: each goes onto the line already
// waiting for the same thing there, adding up ("3 + 2 garlic cloves"), or
// becomes a new line (plannedAdds). A recipe already counted on a line
// isn't counted again, so trying again after an error is safe. A thing
// linked to a pantry item marks it Have when bought.
export async function addToShoppingList(things: Thing[], { list, mainId }: ToList): Promise<Added> {
  const all: Pick<ShoppingItem, "id" | "text" | "pantry_item" | "list" | "recipe" | "shares" | "expand">[] =
    await shoppingItems().getFullList({
      filter: "checked = false",
      fields: "id,text,pantry_item,list,recipe,shares,expand.recipe.title",
      expand: "recipe",
    });
  const here = list || mainId;
  const waiting = rowsOn(all, here, mainId).map((row) => ({ id: row.id, text: row.text, pantryItem: row.pantry_item, shares: sharesOf(row) }));
  const plan = plannedAdds(things, waiting);
  const elsewhere = all.filter((row) => listOf(row, mainId) !== here);
  let alsoElsewhere = 0;
  for (const step of plan.steps) {
    // One at a time, so the list keeps this order.
    if ("create" in step) {
      const { text, pantryItem, shares } = step.create;
      if (elsewhere.some((row) => sameThing({ text, pantryItem }, row))) alsoElsewhere++;
      await shoppingItems().create({
        text: text.trim(),
        checked: false,
        // The first recipe, for older apps, which show only that one.
        recipe: shares[0]?.recipe ?? "",
        shares,
        pantry_item: pantryItem,
        list: storedList(here, mainId),
        added_by: pb.authStore.record?.id,
      });
    } else {
      const { id, text, pantryItem, shares } = step.update;
      await shoppingItems().update(id, { text: text.trim(), pantry_item: pantryItem, shares });
    }
  }
  return { added: plan.added, addedUp: plan.addedUp, skipped: plan.skipped, alsoElsewhere };
}

// How it went: how many added, how many went onto a line already there
// and added up, how many were on that list already, and how many of those
// added wait on another list too.
export interface Added {
  added: number;
  addedUp: number;
  skipped: number;
  alsoElsewhere: number;
}

// "Added 3 items to the shopping list. 2 added up with lines already on it.
// 1 was already on it.", or "to Party" when the household has several
// lists, and "1 is on another list too."
export function addedMessage({ added, addedUp, skipped, alsoElsewhere }: Added, listName = ""): string {
  return (
    `Added ${added} ${added === 1 ? "item" : "items"} to ${listName || "the shopping list"}.` +
    (addedUp ? ` ${addedUp} added up with ${addedUp === 1 ? "a line" : "lines"} already on it.` : "") +
    (skipped ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already on it.` : "") +
    (alsoElsewhere ? ` ${alsoElsewhere} ${alsoElsewhere === 1 ? "is" : "are"} on another list too.` : "")
  );
}

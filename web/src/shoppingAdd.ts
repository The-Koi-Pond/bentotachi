import { pb, shoppingItems } from "./pb";
import { newToTheList } from "./shoppingMatch";

export interface ToBuy {
  text: string;
  // The pantry item it's for, or "" (linked, buying it marks it as Have).
  pantryItem: string;
  // The recipe it's for, or "".
  recipe: string;
}

// Adds things to the shopping list in order, skipping anything already
// waiting on it (newToTheList), so nothing gets doubled up and trying again
// after an error is safe.
export async function addToShoppingList(things: ToBuy[]): Promise<{ added: number; skipped: number }> {
  const waiting: { text: string; pantry_item: string }[] = await shoppingItems().getFullList({
    filter: "checked = false",
    fields: "text,pantry_item",
  });
  const fresh = newToTheList(things, waiting);
  for (const thing of fresh) {
    // One at a time, so the list keeps this order.
    await shoppingItems().create({
      text: thing.text.trim(),
      checked: false,
      recipe: thing.recipe,
      pantry_item: thing.pantryItem,
      added_by: pb.authStore.record?.id,
    });
  }
  return { added: fresh.length, skipped: things.length - fresh.length };
}

// "Added 3 items to the shopping list. 1 was already on it."
export function addedMessage({ added, skipped }: { added: number; skipped: number }): string {
  return (
    `Added ${added} ${added === 1 ? "item" : "items"} to the shopping list.` +
    (skipped ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already on it.` : "")
  );
}

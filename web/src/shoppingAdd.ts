import { pb, shoppingItems } from "./pb";

export interface ToBuy {
  text: string;
  // The pantry item it's for, or "" (linked, buying it marks it as Have).
  pantryItem: string;
  // The recipe it's for, or "".
  recipe: string;
}

// Adds things to the shopping list in order, skipping anything already
// waiting on it (by pantry link or by name), so nothing gets doubled up and
// trying again after an error is safe.
export async function addToShoppingList(things: ToBuy[]): Promise<{ added: number; skipped: number }> {
  const waiting = await shoppingItems().getFullList({ filter: "checked = false", fields: "text,pantry_item" });
  const onListText = new Set(waiting.map((item) => item.text.trim().toLowerCase()));
  const onListPantry = new Set(waiting.map((item) => item.pantry_item).filter(Boolean));
  let added = 0;
  for (const thing of things) {
    const text = thing.text.trim().toLowerCase();
    if ((thing.pantryItem && onListPantry.has(thing.pantryItem)) || onListText.has(text)) continue;
    // One at a time, so the list keeps this order.
    await shoppingItems().create({
      text: thing.text.trim(),
      checked: false,
      recipe: thing.recipe,
      pantry_item: thing.pantryItem,
      added_by: pb.authStore.record?.id,
    });
    onListText.add(text);
    if (thing.pantryItem) onListPantry.add(thing.pantryItem);
    added += 1;
  }
  return { added, skipped: things.length - added };
}

// "Added 3 items to the shopping list. 1 was already on it."
export function addedMessage({ added, skipped }: { added: number; skipped: number }): string {
  return (
    `Added ${added} ${added === 1 ? "item" : "items"} to the shopping list.` +
    (skipped ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already on it.` : "")
  );
}

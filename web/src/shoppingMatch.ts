// Whether something is already on the shopping list, the same way everywhere
// (adding from recipes or the plan, the list's own add box, the Pantry page,
// and the server when a pantry item runs out: server/pb_hooks/pantry.pb.js).
// Tested in web/test/shoppingMatch.test.ts.
import { isJustThis } from "./pantryLinks.ts";
import { otherNames } from "./regionalNames.ts";

// The same pantry item, or the same name (ignoring capitals and spaces)
// unless the two are linked to different pantry items.
export function sameThing(thing: { text: string; pantryItem: string }, item: { text: string; pantry_item: string }): boolean {
  if (thing.pantryItem && item.pantry_item === thing.pantryItem) return true;
  return !linkedApart(thing, item) && item.text.trim().toLowerCase() === thing.text.trim().toLowerCase();
}

// Linked to two different pantry items: never the same thing, whatever
// their words (adding up on the list too, shoppingAddUp.ts).
export function linkedApart(thing: { pantryItem: string }, item: { pantry_item: string }): boolean {
  return !!thing.pantryItem && !!item.pantry_item && thing.pantryItem !== item.pantry_item;
}

// Whether a pantry item is already waiting on the list (by its link, or its
// name on an unlinked row). The pantry only asks "Put it on the shopping
// list?" about an item running out when it isn't.
export function onTheList(item: { id: string; name: string }, waiting: { text: string; pantry_item: string }[]): boolean {
  return waiting.some((row) => sameThing({ text: item.name, pantryItem: item.id }, row));
}

// A row waiting on the list that's this pantry item under another wording
// ("300ml milk" from a recipe, for Milk): just its name with an amount
// (isJustThis, so "Milk chocolate" and "coconut milk" aren't Milk), on a
// row not linked to another pantry item. null if there's none, or it's on
// the list already as itself (onTheList). Ticking a row linked to an item
// puts it back in stock, so a wrong match would leave the real thing
// unbought: when unsure, it isn't one.
export function onTheListAs<T extends { text: string; pantry_item: string }>(item: { id: string; name: string }, waiting: T[]): T | null {
  if (onTheList(item, waiting)) return null;
  const names = [item.name, ...otherNames(item.name)];
  return waiting.find((row) => (!row.pantry_item || row.pantry_item === item.id) && names.some((name) => isJustThis(row.text, name))) ?? null;
}


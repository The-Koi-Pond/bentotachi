// Whether something is already on the shopping list, the same way everywhere
// (adding from recipes or the plan, the list's own add box, the Pantry page,
// and the server when a pantry item runs out: server/pb_hooks/pantry.pb.js).
// Tested in web/test/shoppingMatch.test.ts.

// The same pantry item, or the same name (ignoring capitals and spaces)
// unless the two are linked to different pantry items.
export function sameThing(thing: { text: string; pantryItem: string }, item: { text: string; pantry_item: string }): boolean {
  if (thing.pantryItem && item.pantry_item === thing.pantryItem) return true;
  const linkedElsewhere = !!thing.pantryItem && !!item.pantry_item;
  return !linkedElsewhere && item.text.trim().toLowerCase() === thing.text.trim().toLowerCase();
}

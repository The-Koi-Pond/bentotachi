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

// Whether a pantry item is already waiting on the list (by its link, or its
// name on an unlinked row). The pantry only asks "Put it on the shopping
// list?" about an item running out when it isn't.
export function onTheList(item: { id: string; name: string }, waiting: { text: string; pantry_item: string }[]): boolean {
  return waiting.some((row) => sameThing({ text: item.name, pantryItem: item.id }, row));
}

// Which of these things to add, in order: not what's already waiting on the
// list, and not the same thing twice in one go.
export function newToTheList<T extends { text: string; pantryItem: string }>(
  things: T[],
  waiting: { text: string; pantry_item: string }[]
): T[] {
  const seen = [...waiting];
  const fresh: T[] = [];
  for (const thing of things) {
    if (seen.some((item) => sameThing(thing, item))) continue;
    fresh.push(thing);
    seen.push({ text: thing.text, pantry_item: thing.pantryItem });
  }
  return fresh;
}

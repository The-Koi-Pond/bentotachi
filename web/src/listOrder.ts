// Moving one thing in a list to where another is, as dragging does (recipe
// shelves, pantry places): the rest shift up or down to make room. Tested in
// web/test/listOrder.test.ts.

// The list with the one at `from` moved to `to`; the same list if either
// is outside it, or they're the same.
export function moved<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return list;
  const next = [...list];
  const [moving] = next.splice(from, 1);
  next.splice(to, 0, moving);
  return next;
}

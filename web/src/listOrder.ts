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

// One move in a grip's menu (GripMenu.tsx).
export interface GripMove {
  label: string;
  run: () => void;
  // Can't go that way (the first one can't move up).
  disabled?: boolean;
}

// "Move up" and "Move down" for one in a list: onto the one before it or
// after it, as if dragged there; off at either end, or if it isn't listed.
export function upDownMoves(keys: readonly string[], key: string, moveTo: (toKey: string) => void): GripMove[] {
  const at = keys.indexOf(key);
  const up = at > 0 ? keys[at - 1] : null;
  const down = at >= 0 && at < keys.length - 1 ? keys[at + 1] : null;
  return [
    { label: "Move up", disabled: !up, run: () => up && moveTo(up) },
    { label: "Move down", disabled: !down, run: () => down && moveTo(down) },
  ];
}

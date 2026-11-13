// Keys for a menu opened from a button (role="menu": the ⋮, a recipe's ⋯, a
// grip's moves), as screen readers expect of one: opening it goes to its
// first item, the arrow keys, Home and End move between items, and Escape
// closes it back on its button.
import { useEffect, type RefObject } from "react";

// Where a key moves to from item `at` of `count` (-1: none focused yet), or
// null for a key that isn't a move. Up and down wrap around.
export function menuStep(key: string, at: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowDown") return at < 0 ? 0 : (at + 1) % count;
  if (key === "ArrowUp") return at < 0 ? count - 1 : (at - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

const ITEMS = '[role^="menuitem"]:not(:disabled)';

// `around`: the element holding the button and its open panel.
export function useMenuKeys(
  open: boolean,
  around: RefObject<HTMLElement | null>,
  button: RefObject<HTMLButtonElement | null>,
  close: () => void
) {
  useEffect(() => {
    if (open) around.current?.querySelector<HTMLElement>(ITEMS)?.focus();
  }, [open, around]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Only with focus in the menu: tabbed away into a dialog, Escape is
      // the dialog's.
      if (!around.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        // Only this menu: a cancelled Escape doesn't also close a popover
        // it sits in ("Edit places…").
        event.preventDefault();
        close();
        button.current?.focus();
        return;
      }
      const items = [...(around.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
      const at = items.findIndex((item) => item === document.activeElement);
      const next = menuStep(event.key, at, items.length);
      if (next === null) return;
      event.preventDefault();
      items[next].focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, around, button, close]);
}

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPendingDelete } from "./pendingDelete";
import { announce } from "./announce";

// "Removed “Milk”. Undo": things disappear at once, but are only really
// deleted when the message goes (after a few seconds, another removal, or
// leaving the page). Undo brings them back exactly as they were, since
// nothing was deleted yet. If the app is closed in that moment, the delete
// just doesn't happen. The rules are in pendingDelete.ts (and tested there);
// this shows them.

export function useUndo() {
  // One per page, kept for as long as the page is open.
  const [deletes] = useState(createPendingDelete);
  const pending = useSyncExternalStore(deletes.subscribe, deletes.current);

  // Leaving the page deletes it for real.
  useEffect(() => () => void deletes.leave(), [deletes]);

  const hidden = new Set(pending?.ids ?? []);
  const held = useHoldWhileTouched(pending, deletes.hold, deletes.release);
  // No role of its own: announce() reads the message out (announce.ts says
  // why).
  const toast = pending && (
    <p className="toast undo-toast" {...held}>
      <span>{pending.message}</span>
      <button className="link-button" onClick={() => void deletes.undo()}>
        Undo
      </button>
    </p>
  );
  const offer = useCallback(
    (ids: string[], message: string, commit: () => Promise<void> | void) => {
      deletes.offer(ids, message, commit);
      announce(message);
    },
    [deletes]
  );
  return { hidden, offer, settle: deletes.settle, toast };
}

// A bar with a button in it (Undo) waits while a finger, the mouse or the
// keyboard is on it, so it doesn't vanish just as you reach for the button.
// The pointer and the focus count apart: it lets go only once both have
// left. `bar` is the bar showing now; a new one starts with neither on it,
// since one removed by its own button never hears the pointer leave.
export function useHoldWhileTouched(bar: unknown, hold: () => void, release: () => void) {
  const on = useRef({ bar, pointer: false, focus: false });
  if (on.current.bar !== bar) on.current = { bar, pointer: false, focus: false };
  const set = (which: "pointer" | "focus", value: boolean) => {
    const state = on.current;
    const before = state.pointer || state.focus;
    state[which] = value;
    const after = state.pointer || state.focus;
    if (after && !before) hold();
    else if (before && !after) release();
  };
  return {
    onPointerEnter: () => set("pointer", true),
    onPointerLeave: () => set("pointer", false),
    onFocus: () => set("focus", true),
    onBlur: () => set("focus", false),
  };
}

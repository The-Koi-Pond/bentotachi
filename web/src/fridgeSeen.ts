import { useSyncExternalStore } from "react";
import { remember, remembered } from "./phoneStorage.ts";

// When this phone last opened the fridge door: the newest note's `created`
// then (see unreadNotes in fridgeDoor.ts), or "" if never. Kept on this
// device, so each person's phone counts its own new notes.
const KEY = "bento.fridgeSeen";
const listeners = new Set<() => void>();

let seen = remembered(KEY) ?? "";

export function markFridgeSeen(created: string) {
  if (!created || created <= seen) return;
  seen = created;
  remember(KEY, created);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFridgeSeen(): string {
  return useSyncExternalStore(subscribe, () => seen);
}

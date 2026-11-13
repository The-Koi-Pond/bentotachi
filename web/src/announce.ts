// Passing messages a screen reader should hear (a toast, "Removed “Milk”.
// Undo"), spoken from live regions that are always on the page
// (<Toaster />): a message that arrives already inside a new live region is
// often not read out at all, so the bars themselves carry no role.
import { useSyncExternalStore } from "react";

export interface Announcement {
  text: string;
  // An error: read out straight away, over whatever was being read.
  urgent: boolean;
}

let current: Announcement = { text: "", urgent: false };
const listeners = new Set<() => void>();

function set(next: Announcement) {
  current = next;
  for (const listener of listeners) listener();
}

export function announce(text: string, { urgent = false }: { urgent?: boolean } = {}) {
  if (!text) return;
  // Emptied first, so the same words twice in a row ("Removed “Milk”") are
  // still a change the screen reader hears.
  set({ text: "", urgent });
  setTimeout(() => set({ text, urgent }), 50);
}

// Module-level, so React doesn't resubscribe on every render.
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAnnouncement(): Announcement {
  return useSyncExternalStore(subscribe, () => current);
}

import { useSyncExternalStore } from "react";

// Which category shelves on the Recipes page are open, on this device.
// Normally every shelf starts open and the ones you close stay closed
// (saved). With "Categories start closed" on (⋮ menu), every shelf starts
// closed each time Bento opens; the ones you open stay open until then
// (kept for this session only), so going into a recipe and back keeps
// your place.

const START_CLOSED_KEY = "bento.shelvesStartClosed";
const CLOSED_KEY = "bento.closedShelves";
const OPENED_KEY = "bento.openedShelves";

// Storage can be missing or refuse (private windows, blocked site data);
// then this just isn't remembered.
function readSet(storage: () => Storage, key: string): Set<string> {
  try {
    const saved: unknown = JSON.parse(storage().getItem(key) ?? "[]");
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // Not remembered.
  }
}

function readStartClosed(): boolean {
  try {
    return localStorage.getItem(START_CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

interface DrawerState {
  startClosed: boolean;
  closed: Set<string>;
  opened: Set<string>;
}

let state: DrawerState = {
  startClosed: readStartClosed(),
  closed: readSet(() => localStorage, CLOSED_KEY),
  opened: readSet(() => sessionStorage, OPENED_KEY),
};
const listeners = new Set<() => void>();

function update(next: DrawerState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toggled(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function useShelfDrawers() {
  const current = useSyncExternalStore(subscribe, () => state);
  return {
    startClosed: current.startClosed,
    isOpen: (id: string) => (current.startClosed ? current.opened.has(id) : !current.closed.has(id)),
    toggle(id: string) {
      if (state.startClosed) {
        const opened = toggled(state.opened, id);
        write(() => sessionStorage, OPENED_KEY, JSON.stringify([...opened]));
        update({ ...state, opened });
      } else {
        const closed = toggled(state.closed, id);
        write(() => localStorage, CLOSED_KEY, JSON.stringify([...closed]));
        update({ ...state, closed });
      }
    },
    // Switching it on closes every shelf now, as it will on the next start.
    setStartClosed(on: boolean) {
      write(() => localStorage, START_CLOSED_KEY, on ? "1" : "0");
      write(() => sessionStorage, OPENED_KEY, "[]");
      update({ ...state, startClosed: on, opened: new Set() });
    },
  };
}

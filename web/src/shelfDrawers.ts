import { useSyncExternalStore } from "react";
import { remember, remembered, rememberedJson } from "./phoneStorage";

// Which category shelves on the Recipes page are open, on this device.
// Normally every shelf starts open and the ones you close stay closed
// (saved). With "Shelves start closed" on (Settings), every shelf starts
// closed each time Bento opens; the ones you open stay open until then
// (kept for this session only), so going into a recipe and back keeps
// your place.

const START_CLOSED_KEY = "bento.shelvesStartClosed";
const CLOSED_KEY = "bento.closedShelves";
const OPENED_KEY = "bento.openedShelves";

const VISIT = { thisVisit: true };

function readSet(key: string, where = {}): Set<string> {
  const saved = rememberedJson(key, where);
  return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
}

interface DrawerState {
  startClosed: boolean;
  closed: Set<string>;
  opened: Set<string>;
}

let state: DrawerState = {
  startClosed: remembered(START_CLOSED_KEY) === "1",
  closed: readSet(CLOSED_KEY),
  opened: readSet(OPENED_KEY, VISIT),
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
        remember(OPENED_KEY, JSON.stringify([...opened]), VISIT);
        update({ ...state, opened });
      } else {
        const closed = toggled(state.closed, id);
        remember(CLOSED_KEY, JSON.stringify([...closed]));
        update({ ...state, closed });
      }
    },
    // "Close all" / "Open all" on the Recipes page:
    // these shelves all open or all closed, remembered like one at a time.
    setAll(ids: string[], open: boolean) {
      if (state.startClosed) {
        const opened = new Set(state.opened);
        for (const id of ids) {
          if (open) opened.add(id);
          else opened.delete(id);
        }
        remember(OPENED_KEY, JSON.stringify([...opened]), VISIT);
        update({ ...state, opened });
      } else {
        const closed = new Set(state.closed);
        for (const id of ids) {
          if (open) closed.delete(id);
          else closed.add(id);
        }
        remember(CLOSED_KEY, JSON.stringify([...closed]));
        update({ ...state, closed });
      }
    },
    // Switching it on closes every shelf now, as it will on the next start.
    setStartClosed(on: boolean) {
      remember(START_CLOSED_KEY, on ? "1" : "0");
      remember(OPENED_KEY, "[]", VISIT);
      update({ ...state, startClosed: on, opened: new Set() });
    },
  };
}

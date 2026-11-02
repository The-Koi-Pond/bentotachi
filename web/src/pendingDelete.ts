// The rules behind "Removed “Milk”. Undo" (undo.tsx shows it): a removal
// waits, hidden, and is only really carried out when its time is up,
// another removal comes along, the page is left, or something needs it
// gone first (settle). Undo cancels it. Tested in
// web/test/pendingDelete.test.ts with a clock the test moves by hand.

export const UNDO_SECONDS = 6;

export interface Pending {
  ids: string[];
  message: string;
  commit: () => Promise<void> | void;
}

interface Timer {
  set: (run: () => void, ms: number) => number;
  clear: (id: number | undefined) => void;
}

const realTimer: Timer = {
  set: (run, ms) => window.setTimeout(run, ms),
  clear: (id) => window.clearTimeout(id),
};

export function createPendingDelete(timer: Timer = realTimer, seconds = UNDO_SECONDS) {
  let pending: Pending | null = null;
  let handle: number | undefined;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  // Ends what's waiting: carries it out (commit) or cancels it (Undo).
  async function finish(commit: boolean) {
    timer.clear(handle);
    handle = undefined;
    const current = pending;
    if (!current) return;
    pending = null;
    changed();
    if (commit) await current.commit();
  }

  return {
    // ids: what to hide until then. commit: the real delete.
    offer(ids: string[], message: string, commit: () => Promise<void> | void) {
      void finish(true);
      pending = { ids, message, commit };
      changed();
      handle = timer.set(() => void finish(true), seconds * 1000);
    },
    undo: () => finish(false),
    settle: () => finish(true),
    leave: () => finish(true),
    current: () => pending,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

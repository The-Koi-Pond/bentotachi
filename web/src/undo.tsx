import { useCallback, useEffect, useRef, useState } from "react";

// "Removed “Milk”. Undo": things disappear at once, but are only really
// deleted when the message goes (after a few seconds, another removal, or
// leaving the page). Undo brings them back exactly as they were, since
// nothing was deleted yet. If the app is closed in that moment, the delete
// just doesn't happen.

const UNDO_SECONDS = 6;

interface Pending {
  ids: string[];
  message: string;
  commit: () => Promise<void> | void;
}

export function useUndo() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const finish = useCallback(async (commit: boolean) => {
    window.clearTimeout(timer.current);
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (commit) await current?.commit();
  }, []);

  // ids: what to hide until then. commit: the real delete.
  const offer = useCallback(
    (ids: string[], message: string, commit: () => Promise<void> | void) => {
      void finish(true);
      const next = { ids, message, commit };
      pendingRef.current = next;
      setPending(next);
      timer.current = window.setTimeout(() => void finish(true), UNDO_SECONDS * 1000);
    },
    [finish]
  );

  // Does a waiting delete now, for changes that need it gone first (like
  // planning a new dinner on a night whose dinner was just removed).
  const settle = useCallback(() => finish(true), [finish]);

  // Leaving the page deletes it for real.
  useEffect(() => () => void finish(true), [finish]);

  const hidden = new Set(pending?.ids ?? []);
  const toast = pending && (
    <p className="toast undo-toast" role="status">
      <span>{pending.message}</span>
      <button className="link-button" onClick={() => void finish(false)}>
        Undo
      </button>
    </p>
  );
  return { hidden, offer, settle, toast };
}

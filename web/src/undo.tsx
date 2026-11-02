import { useEffect, useState, useSyncExternalStore } from "react";
import { createPendingDelete } from "./pendingDelete";

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
  const toast = pending && (
    <p className="toast undo-toast" role="status">
      <span>{pending.message}</span>
      <button className="link-button" onClick={() => void deletes.undo()}>
        Undo
      </button>
    </p>
  );
  return { hidden, offer: deletes.offer, settle: deletes.settle, toast };
}

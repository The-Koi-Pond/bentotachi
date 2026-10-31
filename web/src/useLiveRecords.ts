import { useCallback, useEffect, useState } from "react";
import type { RecordModel } from "pocketbase";
import { errorMessage, pb } from "./pb";

// Loads a whole collection and keeps it up to date while anyone changes it.
// Also hands back helpers to update what's on screen straight away, before
// the server confirms (the live update then simply replaces it).
export function useLiveRecords<T extends RecordModel>(collection: string, expand?: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(() => {
    pb.collection<T>(collection)
      .getFullList({ expand })
      .then((list) => {
        setItems(list);
        setLoadError("");
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [collection, expand]);

  const upsert = useCallback((item: T) => {
    setItems((previous) => previous && [...previous.filter((i) => i.id !== item.id), item]);
  }, []);

  const removeLocally = useCallback((id: string) => {
    setItems((previous) => previous && previous.filter((i) => i.id !== id));
  }, []);

  useEffect(() => {
    reload();

    // Live updates: the server tells every open copy of the app about changes.
    let unsubscribe: (() => void) | undefined;
    let stopped = false;
    pb.collection<T>(collection)
      .subscribe(
        "*",
        (event) => {
          if (event.action === "delete") removeLocally(event.record.id);
          else upsert(event.record);
        },
        { expand }
      )
      .then((stop) => {
        if (stopped) stop();
        else unsubscribe = stop;
      })
      .catch(() => {
        // Live updates are a bonus; everything still works without them.
      });

    // Phones pause apps in the background and can miss updates, so reload
    // whenever the app comes back to the front.
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [collection, expand, reload, upsert, removeLocally]);

  return { items, loadError, reload, upsert, removeLocally };
}

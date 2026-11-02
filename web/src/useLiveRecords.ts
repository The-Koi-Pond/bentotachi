import { useCallback, useEffect, useState } from "react";
import type { RecordModel } from "pocketbase";
import { errorMessage, pb } from "./pb";
import { isOffline, read, write } from "./offline";
import { ensureLogin } from "./session";

// Loads a whole collection and keeps it up to date while anyone changes it.
// Also hands back helpers to update what's on screen straight away, before
// the server confirms (the live update then simply replaces it).
//
// With an offlineKey (see offline.ts), the phone keeps a copy of the list,
// and shows it when the server can't be reached (`offline` is then true).
export function useLiveRecords<T extends RecordModel>(collection: string, expand?: string, offlineKey?: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [offline, setOffline] = useState(false);

  const reload = useCallback(() => {
    // First make sure the login is still good: with an expired one the
    // server answers with an empty list, which would replace what's on
    // screen and the phone's copy (session.ts). Signed out, the login screen
    // shows instead; offline, the load below finds that out itself.
    void ensureLogin()
      .then((state) => {
        if (state === "signedOut") return;
        return pb
          .collection<T>(collection)
          // Never an old answer the browser kept: offline should look offline.
          .getFullList({ expand, cache: "no-store" });
      })
      .then((list) => {
        if (!list) return;
        setItems(list);
        setLoadError("");
        setOffline(false);
      })
      .catch((err) => {
        const saved = offlineKey && isOffline(err) ? read<T>(offlineKey) : null;
        if (saved) {
          setItems((current) => current ?? saved);
          setOffline(true);
          setLoadError("");
        } else setLoadError(errorMessage(err));
      });
  }, [collection, expand, offlineKey]);

  // The copy follows what's on screen (including changes made offline).
  useEffect(() => {
    if (offlineKey && items) write(offlineKey, items);
  }, [offlineKey, items]);

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
    // whenever the app comes back to the front, or the connection comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", reload);

    return () => {
      stopped = true;
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", reload);
    };
  }, [collection, expand, reload, upsert, removeLocally]);

  return { items, loadError, offline, setOffline, reload, upsert, removeLocally };
}

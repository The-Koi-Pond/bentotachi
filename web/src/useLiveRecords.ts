import { useCallback, useEffect, useState } from "react";
import { ClientResponseError, type RecordModel } from "pocketbase";
import { errorMessage, pb } from "./pb";
import { isOffline, type OfflineCopy } from "./offline";
import { ensureLogin } from "./session";
import { liveUpdateFailed, stopLive } from "./liveResend";
import { connection, RETRY_EVENT } from "./connection.ts";

interface LiveOptions<T> {
  expand?: string;
  // Only these fields, for a big list the page needs a little of.
  fields?: string;
  sort?: string;
  // The phone's copy of the list (offline.ts), shown when the server can't
  // be reached (`offline` is then true). Made once, outside the page: a new
  // one each render would load the list again each render.
  copy?: OfflineCopy<T>;
}

// Loads a whole collection and keeps it up to date while anyone changes it.
// Also hands back helpers to update what's on screen straight away, before
// the server confirms (the live update then simply replaces it).
export function useLiveRecords<T extends RecordModel>(collection: string, { expand, fields, sort, copy }: LiveOptions<T> = {}) {
  const [items, setItems] = useState<T[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [offline, setOffline] = useState(false);

  const reload = useCallback(() => {
    // First make sure the login is still good: with an expired one the
    // server answers with an empty list, which would replace what's on
    // screen and the phone's copy (session.ts). Signed out, the login screen
    // shows instead; offline, the copy shows without waiting for the load to
    // find that out as well.
    void ensureLogin()
      .then((state) => {
        if (state === "signedOut") return;
        if (state === "offline") throw new ClientResponseError({ status: 0 });
        return pb
          .collection<T>(collection)
          // Never an old answer the browser kept: offline should look offline.
          .getFullList({ expand, fields, sort, cache: "no-store" });
      })
      .then((list) => {
        if (!list) return;
        setItems(list);
        setLoadError("");
        setOffline(false);
      })
      .catch((err) => {
        const saved = copy && isOffline(err) ? copy.read() : null;
        // Each time, not only when it first goes offline (the effect below):
        // a reload that fails again after a comeback must start the check
        // again, or the list stays on its copy.
        if (saved) connection.unreachable();
        if (saved) {
          setItems((current) => current ?? saved);
          setOffline(true);
          setLoadError("");
        } else setLoadError(errorMessage(err));
      });
  }, [collection, expand, fields, sort, copy]);

  // Showing the copy (a load given up on, or the shopping list keeping a
  // change for later) means the server can't be reached now, whatever an
  // earlier answer said: so it's checked every half minute, and this list
  // reloads when it answers (RETRY_EVENT below).
  useEffect(() => {
    if (offline) connection.unreachable();
  }, [offline]);

  // The copy follows what's on screen (including changes made offline).
  useEffect(() => {
    if (copy && items) copy.write(items);
  }, [copy, items]);

  const upsert = useCallback((item: T) => {
    setItems((previous) => previous && [...previous.filter((i) => i.id !== item.id), item]);
  }, []);

  const removeLocally = useCallback((id: string) => {
    setItems((previous) => previous && previous.filter((i) => i.id !== id));
  }, []);

  useEffect(() => {
    reload();

    // Live updates: the server tells every open copy of the app about changes.
    let unsubscribe: (() => Promise<void>) | undefined;
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
        if (stopped) stopLive(stop);
        else unsubscribe = stop;
      })
      .catch(() => {
        // Live updates are a bonus; everything still works without them.
        // Sent again when the connection comes back (liveResend.ts).
        liveUpdateFailed();
      });

    // Phones pause apps in the background and can miss updates, so reload
    // whenever the app comes back to the front, or the connection comes back:
    // the phone's own "online", or the server answering again after it
    // couldn't be reached (connection.ts checks every half minute, since the
    // phone can have signal all along while the server or Tailscale is off).
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", reload);
    window.addEventListener(RETRY_EVENT, reload);

    return () => {
      stopped = true;
      if (unsubscribe) stopLive(unsubscribe);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", reload);
      window.removeEventListener(RETRY_EVENT, reload);
    };
  }, [collection, expand, reload, upsert, removeLocally]);

  // setItems: for changes to many at once (a bulk edit, its Undo).
  return { items, setItems, loadError, offline, setOffline, reload, upsert, removeLocally };
}

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { pantryItems, pantryPhotoUrl, recipeImageUrl, recipePhotoUrl, recipes } from "./pb";
import { connection, RETRY_EVENT, useConnection } from "./connection.ts";
import {
  PHOTO_CACHE,
  countKept,
  fillPhotos,
  keepPhotos,
  keptPhoto,
  photoCacheAvailable,
  photoStatus,
  usePhotoStatus,
  wantedPhotos,
} from "./photoCache.ts";
import { isPhoneMode } from "./phoneMode";
import { ensureLogin } from "./session";

// The screen side of photos kept for offline (photoCache.ts): the hook that
// shows a kept copy when the server can't be reached, and the keeper that
// keeps the copies in step with the household's photos.

// The 600-wide copy each kept photo is (photoCache.ts keeps only those).
export const keptCover = (recipe: Parameters<typeof recipeImageUrl>[0]) => recipeImageUrl(recipe, "600x0");
export const keptStep = (recipe: Parameters<typeof recipePhotoUrl>[0], name: string) => recipePhotoUrl(recipe, name, "600x0");

// An <img>'s src for `url`: itself, or once the server can't be reached
// (known down, or this photo failed to load) and photos are kept, the kept
// copy of `keptUrl` (the 600-wide one, for a full-size photo). `gaveUp`: no
// photo will come (it failed, and nothing's kept or keeping is off), for a
// place to show its stand-in instead. Once the server answers again it all
// starts over, so the server's photo comes back.
export function useKeptPhoto(url: string, keptUrl = url) {
  const { reachable } = useConnection();
  const { on } = usePhotoStatus();
  // This photo's address, once it failed to load.
  const [failed, setFailed] = useState("");
  // A kept copy that failed to show (storage cleared under it).
  const [keptFailed, setKeptFailed] = useState("");
  const [kept, setKept] = useState<{ for: string; src: string | null } | null>(null);
  useEffect(() => {
    if (!reachable) return;
    setFailed("");
    setKeptFailed("");
  }, [reachable]);
  const wantKept = on && !!keptUrl && (reachable === false || failed === url);

  useEffect(() => {
    if (!wantKept) return;
    let live = true;
    let made: string | null = null;
    void keptPhoto(keptUrl).then((src) => {
      made = src;
      if (!live) {
        if (src) URL.revokeObjectURL(src);
        return;
      }
      setKept({ for: keptUrl, src });
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
      // Freed now: never shown again (the next look makes a new one).
      setKept(null);
    };
  }, [wantKept, keptUrl]);

  // undefined: not looked yet; null: looked, nothing kept.
  const found = wantKept && kept?.for === keptUrl ? kept.src : undefined;
  const shown = found && found !== keptFailed ? found : null;
  const nothingKept = found !== undefined && !shown;
  const gaveUp = (failed === url && (!on || !keptUrl || nothingKept)) || (on && reachable === false && nothingKept);

  return {
    src: shown ?? url,
    gaveUp,
    onError: () => {
      if (shown) setKeptFailed(shown);
      else setFailed(url);
    },
  };
}

// An <img> that shows its kept copy offline (useKeptPhoto), or `fallback`
// when no photo will come (a broken image otherwise).
export function KeptImg({
  src,
  keptUrl,
  fallback,
  ...rest
}: { src: string; keptUrl?: string; fallback?: ReactNode } & ImgHTMLAttributes<HTMLImageElement>) {
  const photo = useKeptPhoto(src, keptUrl);
  if (photo.gaveUp && fallback !== undefined) return <>{fallback}</>;
  return <img alt="" {...rest} src={photo.src} onError={photo.onError} />;
}

// How often the keeper looks again while the app is open and in front.
const LOOK_AGAIN_MS = 10 * 60_000;

// While photos are kept: fetches the ones missing and drops the ones gone,
// when the app opens, comes back to the front (at most every ten minutes),
// and when the server answers again after being away. Nothing when photos
// aren't kept. In phone-only mode the photos are on the phone already, so
// any kept from a household server before are let go.
export function PhotoKeeper() {
  const { on } = usePhotoStatus();
  useEffect(() => {
    if (!on || !photoCacheAvailable()) return;
    if (isPhoneMode()) {
      void keepPhotos(false);
      return;
    }
    let running = false;
    let lastRun = 0;
    let stopped = false;
    // What's kept, counted straight away, so Settings says so even offline.
    void caches
      .open(PHOTO_CACHE)
      .then(countKept)
      .catch(() => {
        // Storage blocked: Settings just says nothing's kept.
      });
    async function run(force = false) {
      if (running || stopped || connection.get().reachable === false) return;
      if (!force && Date.now() - lastRun < LOOK_AGAIN_MS) return;
      running = true;
      lastRun = Date.now();
      try {
        // An expired or cancelled login lists nothing (the server answers as
        // to a stranger), which would drop every kept photo: only with a
        // login that's good (session.ts).
        if ((await ensureLogin()) !== "ok") return;
        const [recipeList, itemList] = await Promise.all([
          recipes().getFullList({ fields: "id,collectionId,collectionName,image,photos" }),
          pantryItems().getFullList({ fields: "id,collectionId,collectionName,photo" }),
        ]);
        const wanted = wantedPhotos(recipeList, itemList, { cover: keptCover, step: keptStep, pantry: pantryPhotoUrl });
        await fillPhotos(wanted, { cache: await caches.open(PHOTO_CACHE), stopped: () => stopped || !photoStatus().on });
      } catch (err) {
        // No connection, or storage refused: tried again next time.
        console.warn("Keeping photos for offline didn't finish", err);
      } finally {
        running = false;
      }
    }
    void run(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onBack = () => void run(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(RETRY_EVENT, onBack);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(RETRY_EVENT, onBack);
    };
  }, [on]);
  return null;
}

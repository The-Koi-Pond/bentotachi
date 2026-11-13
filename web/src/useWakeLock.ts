import { useCallback, useEffect, useState } from "react";

const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;

// Keeps the phone screen from dimming while `active`: a timer running, or
// the menu's "Keep screen on". Several can hold it at once; the screen stays
// on while any does. Phones release the lock when the app goes to the
// background, so it is taken again on return. `refused` hears when the
// phone says no (battery saver, say).
export function useKeepAwake(active: boolean, refused?: () => void) {
  useEffect(() => {
    if (!active || !supported) return;
    let stopped = false;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (lock && !lock.released) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        // Let go meanwhile, or another request got there first (a quick
        // switch away and back): never keep one nobody will release.
        if (stopped || (lock && !lock.released)) void sentinel.release();
        else lock = sentinel;
      } catch {
        // Refused: the screen dims as it normally would.
        refused?.();
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active, refused]);
}

// The menu's "Keep screen on" switch.
export function useWakeLock() {
  const [on, setOn] = useState(false);
  const refused = useCallback(() => setOn(false), []);
  useKeepAwake(on, refused);
  return { supported, on, toggle: () => setOn((value) => !value) };
}

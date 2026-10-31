import { useCallback, useEffect, useRef, useState } from "react";

// Stops the phone screen from dimming while cooking. Phones release the lock
// when the app goes to the background, so it is taken again on return.
export function useWakeLock() {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [on, setOn] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    try {
      lock.current = await navigator.wakeLock.request("screen");
    } catch {
      setOn(false);
    }
  }, []);

  useEffect(() => {
    if (!on) return;
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock.current?.release();
      lock.current = null;
    };
  }, [on, acquire]);

  return { supported, on, toggle: () => setOn((value) => !value) };
}

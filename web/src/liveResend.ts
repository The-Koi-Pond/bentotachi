// Brings live updates back after one failed to start. PocketBase's SDK
// (0.28) counts a subscription as sent before the server has it, so one
// whose sending failed (a short drop while a page opened, with the live
// stream itself still up) is never sent again; and when the very first
// connection fails (opened with the server unreachable), it never tries
// again. Either way nothing shows live until the app restarts. The
// listeners stay registered, so having the SDK connect if need be and send
// its whole list again is enough; it only does when the list changes,
// hence a placeholder subscription, taken off again straight away.
import { pb } from "./pb";

let missed = false;

// Stops a live subscription (a page closing). Telling the server can fail
// offline; it lets go of a client whose connection has gone anyway.
export function stopLive(stop: () => Promise<void>) {
  stop().catch(() => {
    // Offline, or not the server answering: nothing to tell it.
  });
}

// A live subscription that failed: sent again when the connection (or the
// app) comes back.
export function liveUpdateFailed() {
  missed = true;
}

async function resend() {
  if (!missed) return;
  missed = false;
  // A name of its own each time: a placeholder from an attempt that failed
  // stays on the SDK's list, and the same name again would change nothing.
  const topic = `bento/resend-${Date.now()}`;
  try {
    const stop = await pb.realtime.subscribe(topic, () => {});
    await stop();
  } catch {
    // Still not reaching the server: tried again next time, without this
    // attempt's placeholder.
    missed = true;
    pb.realtime.unsubscribe(topic).catch(() => {
      // Unreachable still: it's off the SDK's list all the same.
    });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void resend());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void resend();
  });
}

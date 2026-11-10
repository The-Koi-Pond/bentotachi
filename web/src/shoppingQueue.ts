// The shopping list changes made offline (offlineShopping.ts), kept in one
// place for the whole app instead of in each copy of the Shopping page, with
// the one sender that sends them: so leaving the page and coming back while
// they're being sent doesn't send them twice, or put sent ones back.
//
// The queue lives on the phone (localStorage) and is read from there each
// time, so logging out (which clears it, offline.ts) empties it here too.
// If the phone won't store it, it's still kept in memory while the app runs.

import { useSyncExternalStore } from "react";
import { SHOPPING_QUEUE_KEY, read, write } from "./offline";
import { createQueueSender, type QueuedChange } from "./offlineShopping";
import { remembered } from "./phoneStorage";

const listeners = new Set<() => void>();
let stored: string | null = null;
let queue: QueuedChange[] = read<QueuedChange>(SHOPPING_QUEUE_KEY) ?? [];
stored = storedText();

function storedText(): string | null {
  return remembered(SHOPPING_QUEUE_KEY);
}

function current(): QueuedChange[] {
  const text = storedText();
  if (text !== stored) {
    stored = text;
    queue = read<QueuedChange>(SHOPPING_QUEUE_KEY) ?? [];
  }
  return queue;
}

export function setShoppingQueue(update: (queue: QueuedChange[]) => QueuedChange[]) {
  const next = update(current());
  write(SHOPPING_QUEUE_KEY, next);
  stored = storedText();
  queue = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useShoppingQueue(): QueuedChange[] {
  return useSyncExternalStore(subscribe, current);
}

// Another tab changed the queue (sent it, or queued something): this one's
// screen follows.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== SHOPPING_QUEUE_KEY && event.key !== null) return;
    for (const listener of listeners) listener();
  });
}

// One tab sending at a time: two tabs that were both offline share this
// queue, and both sending it would add things twice. Where the browser has
// no locks (very old ones), each tab sends as before.
function acrossTabs<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) return run();
  return navigator.locks.request("bento.shoppingQueueSend", run);
}

export const queueSender = createQueueSender(current, setShoppingQueue, acrossTabs);

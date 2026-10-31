// Shopping list changes made without a connection (in a shop with no
// signal): ticking things off or back on, and adding things. They're kept
// on the phone, shown straight away, and sent once the server can be
// reached again. Removing and "Clear ticked" wait for a connection.
// Tested in web/test/offlineShopping.test.ts.

import type { ShoppingItem } from "./pb";

export type QueuedChange =
  // Something added offline, under a made-up id until it's sent (and maybe
  // ticked off since).
  | { kind: "add"; id: string; text: string; checked: boolean; at: string }
  // Ticked off (or back on): sent as the final state, not a toggle, so
  // sending it twice does no harm.
  | { kind: "check"; id: string; checked: boolean; at: string };

export const OFFLINE_ID_PREFIX = "offline-";
export const isUnsent = (id: string) => id.startsWith(OFFLINE_ID_PREFIX);

// "2026-10-30 09:15:00.000Z", the server's date format, so sorting matches.
export const serverDate = (date: Date) => date.toISOString().replace("T", " ");

export function queueAdd(queue: QueuedChange[], text: string, now: Date, random = Math.random): QueuedChange[] {
  const id = `${OFFLINE_ID_PREFIX}${now.getTime()}-${Math.floor(random() * 1e6)}`;
  return [...queue, { kind: "add", id, text, checked: false, at: serverDate(now) }];
}

// One change per item: the latest. Ticking something added offline just
// changes what will be added.
export function queueCheck(queue: QueuedChange[], id: string, checked: boolean, now: Date): QueuedChange[] {
  const at = serverDate(now);
  if (isUnsent(id)) return queue.map((change) => (change.id === id ? { ...change, checked, at } : change));
  return [...queue.filter((change) => !(change.kind === "check" && change.id === id)), { kind: "check", id, checked, at }];
}

// The list as it will be once the changes are sent: for showing now. A
// tick for something no longer on the list (someone removed it) is
// skipped.
export function withQueued(items: ShoppingItem[], queue: QueuedChange[]): ShoppingItem[] {
  const checks = new Map(queue.flatMap((c) => (c.kind === "check" ? [[c.id, c] as const] : [])));
  const shown = items.map((item) => {
    const change = checks.get(item.id);
    return change ? { ...item, checked: change.checked, updated: change.at } : item;
  });
  const added = queue.flatMap((c) =>
    c.kind === "add"
      ? [{ id: c.id, text: c.text, checked: c.checked, recipe: "", pantry_item: "", added_by: "", created: c.at, updated: c.at } as ShoppingItem]
      : []
  );
  return [...shown, ...added];
}

// Sends the changes in order. Returns the ones still waiting: all from the
// first that couldn't reach the server (offline again). Ones the server
// turns down (like a tick for something removed meanwhile) are dropped.
export async function sendQueued(
  queue: QueuedChange[],
  send: {
    add: (text: string, checked: boolean) => Promise<unknown>;
    check: (id: string, checked: boolean) => Promise<unknown>;
  },
  isOffline: (err: unknown) => boolean
): Promise<QueuedChange[]> {
  for (let i = 0; i < queue.length; i++) {
    const change = queue[i];
    try {
      if (change.kind === "add") await send.add(change.text, change.checked);
      else await send.check(change.id, change.checked);
    } catch (err) {
      if (isOffline(err)) return queue.slice(i);
    }
  }
  return [];
}

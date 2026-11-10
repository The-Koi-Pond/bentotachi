// Shopping list changes made without a connection (in a shop with no
// signal): ticking things off or back on, and adding things. They're kept
// on the phone, shown straight away, and sent once the server can be
// reached again. Removing and "Clear ticked" wait for a connection.
// Tested in web/test/offlineShopping.test.ts.

import type { ShoppingItem } from "./pb";

export type QueuedChange =
  // Something added offline, under a made-up id until it's sent (and maybe
  // ticked off since). `record`: the id it's saved under, picked here, so
  // one that reached the server with its answer lost (a shop's patchy
  // signal) isn't added again: the server refuses a second with that id.
  // Missing on ones queued before.
  | { kind: "add"; id: string; text: string; checked: boolean; at: string; record?: string }
  // Ticked off (or back on): sent as the final state, not a toggle, so
  // sending it twice does no harm.
  | { kind: "check"; id: string; checked: boolean; at: string };

export const OFFLINE_ID_PREFIX = "offline-";
export const isUnsent = (id: string) => id.startsWith(OFFLINE_ID_PREFIX);

// "2026-10-30 09:15:00.000Z", the server's date format, so sorting matches.
export const serverDate = (date: Date) => date.toISOString().replace("T", " ");

// A new record's id, the way PocketBase makes them (15 lower-case letters
// and digits), for saving something under an id chosen beforehand.
const ID_LETTERS = "abcdefghijklmnopqrstuvwxyz0123456789";
export function newRecordId(random = Math.random): string {
  return Array.from({ length: 15 }, () => ID_LETTERS[Math.floor(random() * ID_LETTERS.length)]).join("");
}

// `record`: the id it's to be saved under (one already tried, when the
// first try looked offline), else a new one.
export function queueAdd(queue: QueuedChange[], text: string, now: Date, random = Math.random, record = newRecordId(random)): QueuedChange[] {
  const id = `${OFFLINE_ID_PREFIX}${now.getTime()}-${Math.floor(random() * 1e6)}`;
  return [...queue, { kind: "add", id, text, checked: false, at: serverDate(now), record }];
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

// Whether the server turned a change down for good (400: not allowed, 404:
// that item was removed meanwhile), so sending it again can't help. Anything
// else (no connection, the server having trouble) is worth keeping for
// later. This only holds while logged in: PocketBase answers an expired
// login with the same 400/404, which is why sendQueued checks it first.
const turnedDown = (err: unknown) => [400, 404].includes((err as { status?: number })?.status ?? -1);

// Sends the changes in order, stopping at the first that can't go now.
// Returns the ones handled: sent, or turned down for good. The rest stay
// waiting (see withoutHandled). loggedIn renews the login first (see
// session.ts); if that isn't sure, nothing is sent.
export async function sendQueued(
  queue: QueuedChange[],
  send: {
    loggedIn: () => Promise<boolean>;
    // `record`: the id to save it under ("" lets the server pick one).
    add: (text: string, checked: boolean, record: string) => Promise<unknown>;
    check: (id: string, checked: boolean) => Promise<unknown>;
  }
): Promise<QueuedChange[]> {
  const handled: QueuedChange[] = [];
  if (!(await send.loggedIn())) return handled;
  for (const change of queue) {
    try {
      // Sent before with its answer lost: the server refuses a second one
      // with that id (400), which counts as handled below.
      if (change.kind === "add") await send.add(change.text, change.checked, change.record ?? "");
      else await send.check(change.id, change.checked);
    } catch (err) {
      if (!turnedDown(err)) break;
      // That refused add may be the one already there, ticked or unticked
      // since (in the trolley, or not after all): that still goes.
      if (change.kind === "add" && change.record) {
        try {
          await send.check(change.record, change.checked);
        } catch (again) {
          if (!turnedDown(again)) break;
        }
      }
    }
    handled.push(change);
  }
  return handled;
}

// The queue now, without the changes just handled. By what each change is,
// not its position, nor which copy of it this is (another tab writing the
// queue meanwhile means it's read again as new copies): changes made while
// sending (a newer tick for the same item is a new entry with a new time)
// stay waiting. Taps on items with a change on its way are held off while
// sending (mustWait), so a change is never altered under the send.
const changeKey = (change: QueuedChange) => JSON.stringify([change.kind, change.id, change.checked, change.at, change.kind === "add" ? change.text : ""]);
export function withoutHandled(current: QueuedChange[], handled: QueuedChange[]): QueuedChange[] {
  const done = new Set(handled.map(changeKey));
  return current.filter((change) => !done.has(changeKey(change)));
}

// One send at a time for the whole app, not each copy of the Shopping page:
// leaving the page and coming back mid-send would otherwise send the same
// changes again (adding things twice). get/set reach the one shared queue
// (shoppingQueue.ts); the result says how many of how many were handled, or
// null when there was nothing to do or a send was already running.
// `exclusive` runs a send while no other tab is sending (they share the
// queue); the queue is read inside it, so what another tab sent meanwhile
// isn't sent again.
export function createQueueSender(
  get: () => QueuedChange[],
  set: (update: (queue: QueuedChange[]) => QueuedChange[]) => void,
  exclusive: <T>(run: () => Promise<T>) => Promise<T> = (run) => run()
) {
  let sending = false;
  return {
    isSending: () => sending,
    async send(how: Parameters<typeof sendQueued>[1]): Promise<{ handled: number; total: number } | null> {
      if (sending || !get().length) return null;
      sending = true;
      try {
        return await exclusive(async () => {
          const queue = get();
          if (!queue.length) return null;
          const handled = await sendQueued(queue, how);
          set((current) => withoutHandled(current, handled));
          return { handled: handled.length, total: queue.length };
        });
      } finally {
        sending = false;
      }
    },
  };
}

// "Clear ticked": things added offline and not sent yet just leave the
// queue (the server doesn't have them); the rest are deleted on the server.
// While a send is running, wait if any of them has a change on its way.
export function clearPlan(sending: boolean, queue: QueuedChange[], ticked: { id: string }[]) {
  return {
    wait: ticked.some((item) => mustWait(sending, queue, item.id)),
    unsent: ticked.filter((item) => isUnsent(item.id)).map((item) => item.id),
    sent: ticked.filter((item) => !isUnsent(item.id)).map((item) => item.id),
  };
}

// While sending: whether a tap on this item has to wait. An item added
// offline could be added twice or not removed; one with a tick waiting
// would have a newer tick undone by that older one arriving after it.
export function mustWait(sending: boolean, queue: QueuedChange[], id: string): boolean {
  return sending && (isUnsent(id) || queue.some((change) => change.id === id));
}

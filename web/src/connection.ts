// Whether Bentotachi can reach its server, for the indicator beside ⋮
// (ConnectionStatus.tsx): every request reports how it went (pb.ts sends
// them through `requestFetch`), and so does a page that falls back to its
// offline copy. While the server can't be reached, it's checked again every
// half minute; when it answers, every open list reloads (RETRY_EVENT).

import { useSyncExternalStore } from "react";
import { isServerAnswer } from "./loginGuard.ts";
import { remember, remembered } from "./phoneStorage.ts";
import { localToday, timeAgo } from "./dates.ts";
import { answerInTime, needsQuickAnswer } from "./answerTimeout.ts";

// Lists (useLiveRecords) and live updates (liveResend.ts) listen for this to
// load again.
export const RETRY_EVENT = "bento:retry";
const LAST_REACHED_KEY = "bento.lastReached";
const CHECK_EVERY_MS = 30_000;
// Saving the time on every answer would write the phone's storage constantly.
const SAVE_EVERY_MS = 30_000;

export interface ConnectionState {
  // null until the first request has gone one way or the other.
  reachable: boolean | null;
  // When the server last answered (ms), kept on the phone, so it's known
  // after opening the app offline.
  lastReached: number | null;
}

// check: asks the server (a quick health check, set by pb.ts with setCheck,
// so this file needs no pb.ts). every: starts a repeating timer and returns
// how to stop it. onBack: the server answered after being unreachable.
export function createConnection({
  now = () => Date.now(),
  saved = () => Number(remembered(LAST_REACHED_KEY)) || null,
  save = (time: number) => remember(LAST_REACHED_KEY, String(time)),
  onBack = () => {},
  every = () => () => {},
}: {
  now?: () => number;
  saved?: () => number | null;
  save?: (time: number) => void;
  onBack?: () => void;
  every?: (run: () => void, ms: number) => () => void;
} = {}) {
  let state: ConnectionState = { reachable: null, lastReached: saved() };
  // The last answer's time; on screen (lastReached) only once it's gone
  // down, so answers don't redraw the page each time.
  let lastAnswer = state.lastReached;
  let lastSaved = lastAnswer ?? 0;
  let comebacks = 0;
  let check: () => Promise<unknown> = () => Promise.resolve();
  let stopChecking: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function askServer() {
    return check().catch(() => {
      // Still unreachable: the request itself has said so.
    });
  }

  function set(next: ConnectionState) {
    if (next.reachable === state.reachable && next.lastReached === state.lastReached) return;
    state = next;
    // While unreachable, ask again every half minute; no more once it answers.
    if (state.reachable === false) stopChecking ??= every(() => void askServer(), CHECK_EVERY_MS);
    else if (stopChecking) {
      stopChecking();
      stopChecking = null;
    }
    for (const listener of listeners) listener();
  }

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    now,
    setCheck(ask: () => Promise<unknown>) {
      check = ask;
    },
    answered() {
      const time = now();
      lastAnswer = time;
      if (time - lastSaved >= SAVE_EVERY_MS) {
        save(time);
        lastSaved = time;
      }
      const wasDown = state.reachable === false;
      set({ reachable: true, lastReached: state.lastReached });
      if (wasDown) {
        comebacks++;
        onBack();
      }
    },
    // sentAt: when the failed request went. One sent before the latest
    // answer (it hung while the server was away, and gave up after it came
    // back) says nothing about now. A page falling back to its copy calls
    // this without one: it can't load now.
    unreachable(sentAt = now()) {
      if (lastAnswer !== null && sentAt < lastAnswer) return;
      if (lastAnswer !== null && lastAnswer !== lastSaved) {
        save(lastAnswer);
        lastSaved = lastAnswer;
      }
      set({ reachable: false, lastReached: lastAnswer });
    },
    // Asks the server now (Try again). If it answers, the lists reload once:
    // by coming back, or here if it never looked down.
    async checkNow() {
      const before = comebacks;
      await askServer();
      if (state.reachable && comebacks === before) onBack();
    },
  };
}

type Connection = ReturnType<typeof createConnection>;

// "today at 2:14 pm", "yesterday at 9:05 am", "5 days ago".
export function heardWhen(time: number, now = new Date()): string {
  const day = localToday(new Date(time));
  const today = localToday(now);
  const ago = timeAgo(day, today);
  if (ago !== "today" && ago !== "yesterday") return ago;
  return `${ago} at ${new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()}`;
}

// A fetch that tells `connection` how it went: an answer from the server,
// or nothing (no connection, no answer in time, or something else answering
// in its place). Cancelled by the page itself counts as neither.
export function watched(send: typeof fetch, connection: Pick<Connection, "answered" | "unreachable" | "now">): typeof fetch {
  return (input, init) => {
    const sentAt = connection.now();
    return send(input, init).then(
      (response) => {
        if (isServerAnswer(response.status, response.headers.get("content-type"), response.headers.get("content-length"))) connection.answered();
        else connection.unreachable(sentAt);
        return response;
      },
      (err) => {
        if (!init?.signal?.aborted) connection.unreachable(sentAt);
        throw err;
      }
    );
  };
}

// The fetch one request goes out with (pb.ts's beforeSend): given up on
// after 8 seconds without an answer starting when that's safe
// (answerTimeout.ts), and watched. In this order, so a request given up on
// counts as no answer, not as the page cancelling it.
export function requestFetch(
  url: string,
  options: { method?: string; body?: unknown; fetch?: typeof fetch },
  connection: Pick<Connection, "answered" | "unreachable" | "now" | "get">
): typeof fetch {
  const send: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const quick = needsQuickAnswer(url, options.method ?? "GET", options.body, { down: connection.get().reachable === false });
  return watched(quick ? answerInTime(send) : send, connection);
}

const tellLists = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(RETRY_EVENT));
};

export const connection = createConnection({
  onBack: tellLists,
  every: (run, ms) => {
    if (typeof window === "undefined") return () => {};
    const timer = window.setInterval(run, ms);
    return () => window.clearInterval(timer);
  },
});

export function useConnection(): ConnectionState {
  return useSyncExternalStore(connection.subscribe, connection.get);
}

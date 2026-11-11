// Gives up on loading the household's records when the server doesn't start
// answering in time. With nothing on the way to it (Tailscale switched off,
// a dead corner of the shop), a request can wait minutes before the phone
// calls it failed, with the page stuck on "Loading…"; given up, it counts as
// offline (status 0) and the phone's copy shows.

// Long enough for a slow phone signal to get the first bytes back.
const ANSWER_WITHIN_MS = 8_000;

// Which requests get the limit. Loading records, renewing the login and the
// health check: nothing is lost by giving up. A save is different: one the
// server made but answered late would look failed, and the page would put
// back what it changed (a mistaken Out's packets would be gone with no
// Undo), so saves wait as long as it takes. Except shopping list changes
// that are sent again safely (their own ids, offlineShopping.ts), and any
// save while the server is already known to be unreachable (`down`): then
// the page puts its change back after 8 seconds rather than minutes. The
// server's other routes can rightly take longer (an import fetching a
// website, a barcode looked up elsewhere), and so can an upload (FormData),
// which only gets its answer once every byte has gone.
export function needsQuickAnswer(url: string, method: string, body: unknown, { down = false } = {}): boolean {
  if (typeof FormData !== "undefined" && body instanceof FormData) return false;
  if (/\/api\/health(\?|$)/.test(url)) return true;
  if (!url.includes("/api/collections/")) return false;
  if (method.toUpperCase() === "GET" || /\/auth-refresh(\?|$)/.test(url)) return true;
  return (url.includes("/api/collections/shopping_items/") && safeToResend(method, body)) || down;
}

// A tick or a removal ends the same however often it's sent; a new item
// only when it carries its own id (the shopping list's do; the pantry's
// "add to list" doesn't, and a second try would add it twice).
function safeToResend(method: string, body: unknown): boolean {
  if (method.toUpperCase() !== "POST") return true;
  return typeof body === "object" && body !== null && typeof (body as { id?: unknown }).id === "string";
}

// A fetch that aborts if the answer hasn't started within `ms`. Once it has,
// the rest (a long list) takes as long as it takes. The caller's own signal
// still cancels it too.
export function answerInTime(send: typeof fetch, ms = ANSWER_WITHIN_MS): typeof fetch {
  return (input, init = {}) => {
    const late = new AbortController();
    const timer = setTimeout(() => late.abort(), ms);
    const theirs = init.signal;
    if (theirs) {
      if (theirs.aborted) late.abort();
      else theirs.addEventListener("abort", () => late.abort(), { once: true });
    }
    return send(input, { ...init, signal: late.signal }).finally(() => clearTimeout(timer));
  };
}

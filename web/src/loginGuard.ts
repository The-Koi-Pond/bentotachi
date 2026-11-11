// Making sure the login is still good before loading or sending anything,
// without asking the server every time: one renewal at a time, shared by
// everyone asking, and a confirmed login counts as good for a while (a
// renewal makes it last days). Used by session.ts; tested in
// web/test/loginGuard.test.ts.

// "ok": logged in. "offline": the server couldn't be reached, so a list can
// go straight to the phone's copy. "unknown": couldn't check (the server had
// trouble), so carry on carefully. "signedOut": the login is no longer good.
export type LoginState = "ok" | "offline" | "unknown" | "signedOut";

// Whether a failed renewal is PocketBase itself refusing the login (401 or
// 403 with its own JSON answer, which names the status), not a public
// Wi-Fi's sign-in or "forbidden" page answering in its place: only that
// signs anyone out. `err` is the PocketBase client's error.
export function isServerRefusal(err: unknown): boolean {
  const { status, response } = (err ?? {}) as { status?: number; response?: { status?: unknown } };
  return (status === 401 || status === 403) && response?.status === status;
}

// Whether an answer could be the server's: PocketBase answers in JSON, or
// with nothing at all ("done": 204, as a delete gets). Anything else (a
// public Wi-Fi's sign-in page, answering every request with its own HTML)
// came from something in the way, and the PocketBase client would read it
// as an empty list or a save that worked.
export function isServerAnswer(status: number, contentType: string | null, contentLength: string | null): boolean {
  if (status === 204 || contentLength === "0") return true;
  return (contentType ?? "").toLowerCase().includes("json");
}

// freshFor: how long a confirmed login counts as good for loading things (a
// minute: a login revoked on another phone shows up quickly). Before
// changing anything, ask with maxAge 0, so it's always checked fresh.
export function createLoginGuard(renew: () => Promise<LoginState>, now = () => Date.now(), freshFor = 60_000) {
  let confirmedAt = -Infinity;
  let pending: Promise<LoginState> | null = null;
  return {
    ensure(maxAge = freshFor): Promise<LoginState> {
      if (now() - confirmedAt < maxAge) return Promise.resolve("ok");
      pending ??= renew()
        .then((state) => {
          if (state === "ok") confirmedAt = now();
          return state;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    // Someone logged in or out: the next check asks the server.
    forget() {
      confirmedAt = -Infinity;
    },
  };
}

// Making sure the login is still good before loading or sending anything,
// without asking the server every time: one renewal at a time, shared by
// everyone asking, and a confirmed login counts as good for a while (a
// renewal makes it last days). Used by session.ts; tested in
// web/test/loginGuard.test.ts.

// "ok": logged in. "unknown": couldn't check (offline, or the server had
// trouble), so carry on carefully. "signedOut": the login is no longer good.
export type LoginState = "ok" | "unknown" | "signedOut";

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

// Renewing the login: when the app opens, before any list loads (useLiveRecords),
// and before sending shopping list changes made offline. PocketBase answers
// a request with an expired login as if nobody were logged in (an empty list,
// or 400/404 for a change), not with 401, so without checking first an
// expired login would show empty lists, save them as the offline copy, and
// make good changes look refused; only the renewal itself answers 401
// (server/test/expired-login.check.mjs).

import { logOut, pb, users, type User } from "./pb";
import { isPhoneMode, logInOnPhone } from "./phoneMode";
import { createLoginGuard, isServerRefusal, type LoginState } from "./loginGuard";

export type { LoginState };

async function renewLogin(): Promise<LoginState> {
  try {
    // Sent by hand rather than with authRefresh, which saves whatever comes
    // back: a public Wi-Fi's sign-in page answering "OK" in the server's
    // place reads as an empty login, and would sign everyone out.
    const answer = await pb.send<{ token?: string; record?: User }>(`/api/collections/${users().collectionIdOrName}/auth-refresh`, {
      method: "POST",
    });
    if (!answer?.token || !answer.record) return "unknown";
    pb.authStore.save(answer.token, answer.record);
    return "ok";
  } catch (err) {
    if (!isServerRefusal(err)) return "unknown";
    // On a phone-only Bento, just log back in with the phone's account.
    if (isPhoneMode() && (await logInOnPhone())) return "ok";
    // No longer good: the login screen shows. Shopping changes made offline
    // that haven't gone yet are kept, and go after logging back in.
    logOut({ keepWaiting: true });
    return "signedOut";
  }
}

const guard = createLoginGuard(renewLogin);
pb.authStore.onChange(() => guard.forget());

// The login, renewed if it hasn't been confirmed in the last minute (one
// renewal at a time, however many pages ask). "signedOut" means it's been
// cleared and the login screen shows.
export function ensureLogin(): Promise<LoginState> {
  return guard.ensure();
}

// The same, always asking the server: before sending changes, which a
// login revoked a moment ago would make look refused (and lose).
export function ensureLoginNow(): Promise<LoginState> {
  return guard.ensure(0);
}

// Renewing the login: when the app opens, before any list loads (useLiveRecords),
// and before sending shopping list changes made offline. PocketBase answers
// a request with an expired login as if nobody were logged in (an empty list,
// or 400/404 for a change), not with 401, so without checking first an
// expired login would show empty lists, save them as the offline copy, and
// make good changes look refused; only the renewal itself answers 401
// (server/test/expired-login.check.mjs).

import { pb } from "./pb";
import { forgetOfflineCopy } from "./offline";
import { isPhoneMode, logInOnPhone } from "./phoneMode";
import { createLoginGuard, type LoginState } from "./loginGuard";

export type { LoginState };

async function renewLogin(): Promise<LoginState> {
  try {
    await pb.collection("users").authRefresh();
    return "ok";
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status !== 401 && status !== 403) return "unknown";
    // On a phone-only Bento, just log back in with the phone's account.
    if (isPhoneMode() && (await logInOnPhone())) return "ok";
    // No longer good: the login screen shows. Shopping changes made offline
    // that haven't gone yet are kept, and go after logging back in.
    forgetOfflineCopy({ keepWaiting: true });
    pb.authStore.clear();
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

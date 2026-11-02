// Renewing the login: when the app opens, and before sending shopping list
// changes made offline. PocketBase answers a request with an expired login
// as if nobody were logged in (400 or 404, not 401), so sending without
// checking first could make good changes look refused and lose them; only
// the renewal itself answers 401 (server/test/expired-login.check.mjs).

import { pb } from "./pb";
import { forgetOfflineCopy } from "./offline";
import { isPhoneMode, logInOnPhone } from "./phoneMode";

// "ok": logged in. "unknown": couldn't check (offline, or the server had
// trouble), so wait. "signedOut": the login is no longer good; it's been
// cleared (the login screen shows), keeping changes made offline that
// haven't gone yet so they're sent after logging back in.
export type LoginState = "ok" | "unknown" | "signedOut";

export async function renewLogin(): Promise<LoginState> {
  try {
    await pb.collection("users").authRefresh();
    return "ok";
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status !== 401 && status !== 403) return "unknown";
    // On a phone-only Bento, just log back in with the phone's account.
    if (isPhoneMode() && (await logInOnPhone())) return "ok";
    forgetOfflineCopy({ keepWaiting: true });
    pb.authStore.clear();
    return "signedOut";
  }
}

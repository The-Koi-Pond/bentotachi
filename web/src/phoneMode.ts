import { registerPlugin } from "@capacitor/core";
import { isAndroidApp, pb } from "./pb";

// Phone-only mode ("Just me, on this phone"): Bento's own server runs inside
// the Android app (BentoLocalServerPlugin.java, mobile/bentoserver), so
// there's nothing to set up. It listens only on this phone, on a different
// port each time, so the app asks it for its address on every start.
//
// The account is made for the person (they only give their name); its
// password stays on the phone, so Bento logs in by itself. The Backups page
// shows both, for moving the backup to a real server later.

interface LocalServerPlugin {
  start(): Promise<{ url: string }>;
  backup(): Promise<{ saved: boolean }>;
  restore(): Promise<{ restored: boolean; url?: string }>;
}

const LocalServer = registerPlugin<LocalServerPlugin>("BentoLocalServer");

const MODE_KEY = "bento.serverMode";
const ACCOUNT_KEY = "bento.phoneAccount";

export interface PhoneAccount {
  username: string;
  password: string;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not saved; it'll be asked again.
  }
}

export function isPhoneMode(): boolean {
  return isAndroidApp && read(MODE_KEY) === "phone";
}

export function phoneAccount(): PhoneAccount | null {
  try {
    const account = JSON.parse(read(ACCOUNT_KEY) ?? "null");
    return account && typeof account.username === "string" && typeof account.password === "string" ? account : null;
  } catch {
    return null;
  }
}

// Starts the phone's server (if it isn't already) and points Bento at it.
export async function startPhoneServer() {
  const { url } = await LocalServer.start();
  pb.baseURL = url;
}

// Logs in with the account saved on this phone; false if that didn't work
// (like after restoring a backup with other accounts in it).
export async function logInOnPhone(): Promise<boolean> {
  const account = phoneAccount();
  if (!account) return false;
  try {
    await pb.collection("users").authWithPassword(account.username, account.password);
    return true;
  } catch {
    return false;
  }
}

// "Just me, on this phone": starts the server, makes the account the first
// time (or logs back into it), and remembers phone mode.
export async function setUpPhone(name: string) {
  await startPhoneServer();
  const { needsSetup } = await pb.send<{ needsSetup: boolean }>("/api/cookbook/setup", {});
  if (needsSetup) {
    const account = { username: usernameFor(name), password: randomPassword() };
    await pb.send("/api/cookbook/setup", { method: "POST", body: { ...account, name: name.trim() } });
    write(ACCOUNT_KEY, JSON.stringify(account));
  }
  write(MODE_KEY, "phone");
  if (!(await logInOnPhone())) throw new Error("Bento is already set up on this phone with another account. Log in with it below.");
}

// Back to choosing on the login screen. What's on the phone stays there, in
// case they come back to it.
export function leavePhoneMode() {
  write(MODE_KEY, null);
  pb.authStore.clear();
}

export async function backUpPhone(): Promise<boolean> {
  return (await LocalServer.backup()).saved;
}

// Replaces everything with a backup the person picks. Afterwards they're
// logged in again if the backup has this phone's account; otherwise the login
// screen asks for one of the backup's accounts.
export async function restorePhone(): Promise<boolean> {
  try {
    const result = await LocalServer.restore();
    if (!result.restored) return false;
    if (result.url) pb.baseURL = result.url;
  } catch (err) {
    // Nothing was changed, but the server may have moved port.
    await startPhoneServer();
    throw err;
  }
  pb.authStore.clear();
  await logInOnPhone();
  return true;
}

// Saves the account for logging in later (after logging in by hand, like
// with an account from a restored backup).
export function rememberPhoneAccount(account: PhoneAccount) {
  write(ACCOUNT_KEY, JSON.stringify(account));
}

// "Sam Smith" -> "samsmith"; something usable even for names like "李".
function usernameFor(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return clean.length >= 2 ? clean.slice(0, 30) : "me";
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

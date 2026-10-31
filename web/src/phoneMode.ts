import { registerPlugin } from "@capacitor/core";
import { isAndroidApp, pb } from "./pb";
import { forgetOfflineCopy } from "./offline";

// Phone-only mode ("Just me, on this phone"): Bento's own server runs inside
// the Android app (BentoLocalServerPlugin.java, mobile/bentoserver), so
// there's nothing to set up. It listens only on this phone, on a different
// port each time, so the app asks it for its address on every start.
//
// The account is made for the person (they only give their name); its
// password stays on the phone, so Bento logs in by itself. The Backups page
// shows both, for moving the backup to a real server later.

interface LocalServerPlugin {
  supported(): Promise<{ supported: boolean }>;
  erase(): Promise<void>;
  rescue(): Promise<{ saved: boolean }>;
  start(): Promise<{ url: string }>;
  backup(): Promise<{ saved: boolean }>;
  restore(): Promise<{ restored: boolean; url?: string }>;
}

const LocalServer = registerPlugin<LocalServerPlugin>("BentoLocalServer");

const MODE_KEY = "bento.serverMode";
const ACCOUNT_KEY = "bento.phoneAccount";
const LAST_BACKUP_KEY = "bento.lastBackup";

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

// Whether this phone can run Bento's own server: it's built for 64-bit ARM
// phones (nearly all phones since about 2017), not older 32-bit ones or
// Chromebooks. Never in a browser.
export async function phoneModeSupported(): Promise<boolean> {
  if (!isAndroidApp) return false;
  try {
    return (await LocalServer.supported()).supported;
  } catch {
    return false;
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
    // Saved before the account is made, so the app being closed in between
    // can't leave an account nobody knows the password to. If making it
    // fails, the one saved before is put back.
    const before = read(ACCOUNT_KEY);
    write(ACCOUNT_KEY, JSON.stringify(account));
    try {
      await pb.send("/api/cookbook/setup", { method: "POST", body: { ...account, name: name.trim() } });
    } catch (err) {
      write(ACCOUNT_KEY, before);
      throw err;
    }
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

// "Delete my account" on a phone-only Bento: everything on this phone goes
// (the server's data, the saved login, the offline copies), and the app
// starts again as if new.
export async function erasePhone() {
  await LocalServer.erase();
  write(MODE_KEY, null);
  write(ACCOUNT_KEY, null);
  write(LAST_BACKUP_KEY, null);
  forgetOfflineCopy();
  pb.authStore.clear();
}

export async function backUpPhone(): Promise<boolean> {
  const { saved } = await LocalServer.backup();
  if (saved) write(LAST_BACKUP_KEY, new Date().toISOString());
  return saved;
}

// When the server won't start: copies Bento's data straight out into a
// backup file (without the server) and asks where to save it.
export async function rescuePhone(): Promise<boolean> {
  const { saved } = await LocalServer.rescue();
  if (saved) write(LAST_BACKUP_KEY, new Date().toISOString());
  return saved;
}

// When a backup was last saved from this phone, or null for never (see
// backupReminder.ts).
export function lastBackup(): Date | null {
  const saved = read(LAST_BACKUP_KEY);
  const date = saved ? new Date(saved) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
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

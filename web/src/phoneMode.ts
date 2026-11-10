import { registerPlugin } from "@capacitor/core";
import { isAndroidApp, pb, users } from "./pb";
import { forgetOfflineCopy, read as readList, SHOPPING_QUEUE_KEY } from "./offline";
import { remember, remembered, rememberedJson } from "./phoneStorage";
import { askBetween, askFirst } from "./askFirst";

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
  return isAndroidApp && remembered(MODE_KEY) === "phone";
}

export function phoneAccount(): PhoneAccount | null {
  const account = rememberedJson(ACCOUNT_KEY) as Partial<PhoneAccount> | null;
  return account && typeof account.username === "string" && typeof account.password === "string"
    ? { username: account.username, password: account.password }
    : null;
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
    await users().authWithPassword(account.username, account.password);
    return true;
  } catch {
    return false;
  }
}

// The phone's server has no account yet but no name was given: the app
// was closed during first-time setup, after the account was saved here but
// before the server made it, so "Welcome back" didn't ask for one.
export class PhoneNeedsName extends Error {
  constructor() {
    super("Bentotachi on this phone wasn't quite set up. What's your name?");
  }
}

// "Just me, on this phone": starts the server, makes the account the first
// time (or logs back into it), and remembers phone mode.
export async function setUpPhone(name: string) {
  await startPhoneServer();
  const { needsSetup } = await pb.send<{ needsSetup: boolean }>("/api/cookbook/setup", {});
  if (needsSetup && !name.trim()) throw new PhoneNeedsName();
  if (needsSetup) {
    const account = { username: usernameFor(name), password: randomPassword() };
    // Saved before the account is made, so the app being closed in between
    // can't leave an account nobody knows the password to. If making it
    // fails, the one saved before is put back.
    const before = remembered(ACCOUNT_KEY);
    remember(ACCOUNT_KEY, JSON.stringify(account));
    try {
      await pb.send("/api/cookbook/setup", { method: "POST", body: { ...account, name: name.trim() } });
    } catch (err) {
      remember(ACCOUNT_KEY, before);
      throw err;
    }
  }
  remember(MODE_KEY, "phone");
  if (!(await logInOnPhone())) throw new Error("Bentotachi is already set up on this phone with another account. Log in with it below.");
}

// Back to choosing on the login screen. The phone's server and its data
// stay, in case they come back to it. The offline copies of its lists go,
// or the next server's pages could show them as theirs when they can't load.
// Shopping changes not sent yet (rare: the phone's own server was down) are
// asked about: right to send to a server that has this phone's backup
// restored (same records), wrong for anyone else's. Closing that question
// without an answer (back, Escape) stays in phone-only mode with them kept.
// Whether it left.
export async function leavePhoneMode(): Promise<boolean> {
  const waiting = (readList(SHOPPING_QUEUE_KEY) ?? []).length;
  let keepWaiting = false;
  if (waiting > 0) {
    const them = waiting === 1 ? "it" : "them";
    const answer = await askBetween(
      `This phone has ${waiting} shopping list ${waiting === 1 ? "change" : "changes"} that ${waiting === 1 ? "wasn't" : "weren't"} sent. ` +
        `Send ${them} to the server you're switching to? Only if that server has this phone's data (its backup restored there).`,
      { yes: `Send ${them}`, no: `Throw ${them} away` }
    );
    if (answer === null) return false;
    keepWaiting = answer === "yes";
  }
  forgetOfflineCopy({ keepWaiting });
  remember(MODE_KEY, null);
  pb.authStore.clear();
  return true;
}

// "Join a household" (Profile, and Backups): after asking, back to the login
// screen to connect to the household's server. What's on this phone stays,
// and comes back with "Just me, on this phone".
export async function switchToServer() {
  if (
    !(await askFirst(
      "Join your household's Bentotachi? What you've added on this phone stays here, and comes back if you choose “Just me, on this phone” again.",
      { yes: "Join a household" }
    ))
  )
    return;
  if (await leavePhoneMode()) window.location.reload();
}

// "Delete my account" on a phone-only Bento: everything on this phone goes
// (the server's data, the saved login, the offline copies), and the app
// starts again as if new.
export async function erasePhone() {
  await LocalServer.erase();
  remember(MODE_KEY, null);
  remember(ACCOUNT_KEY, null);
  remember(LAST_BACKUP_KEY, null);
  forgetOfflineCopy();
  pb.authStore.clear();
}

export async function backUpPhone(): Promise<boolean> {
  const { saved } = await LocalServer.backup();
  if (saved) remember(LAST_BACKUP_KEY, new Date().toISOString());
  return saved;
}

// Android sometimes closes Bentotachi in the background while the "save as"
// screen for a backup is open. The fresh start still saves the backup where
// the person picked (BentoLocalServerPlugin keeps its path), and gets the
// answer as Capacitor's "appRestoredResult": bentoBrowser.ts hears it, hands
// it here, and opens Backups, which shows it (takeRestoredBackupNote).
export type BackupNote = { text: string; isError: boolean };
let restoredBackupNote: BackupNote | null = null;

export function noteRestoredBackup(saved: boolean, error?: string) {
  if (saved) remember(LAST_BACKUP_KEY, new Date().toISOString());
  restoredBackupNote = saved
    ? { text: "Backup saved.", isError: false }
    : { text: error || "Android closed Bentotachi meanwhile, so the backup wasn't saved. Try again.", isError: true };
}

export function takeRestoredBackupNote(): BackupNote | null {
  const note = restoredBackupNote;
  restoredBackupNote = null;
  return note;
}

// When the server won't start: copies Bento's data straight out into a
// backup file (without the server) and asks where to save it.
export async function rescuePhone(): Promise<boolean> {
  const { saved } = await LocalServer.rescue();
  if (saved) remember(LAST_BACKUP_KEY, new Date().toISOString());
  return saved;
}

// When a backup was last saved from this phone, or null for never (see
// backupReminder.ts).
export function lastBackup(): Date | null {
  const saved = remembered(LAST_BACKUP_KEY);
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
  // Everything was replaced: the offline copies, and changes waiting to be
  // sent, belonged to what was here before.
  forgetOfflineCopy();
  pb.authStore.clear();
  await logInOnPhone();
  return true;
}

// Saves the account for logging in later (after logging in by hand, like
// with an account from a restored backup).
export function rememberPhoneAccount(account: PhoneAccount) {
  remember(ACCOUNT_KEY, JSON.stringify(account));
}

// (Profile hides the username and password in phone mode, so the saved
// account can't drift from the real one: the next automatic login would
// fail and lock them out, as they never saw the random password. Show those
// boxes in phone mode again and the saved account must follow changes.)

// "Sam Smith" -> "samsmith"; something usable even for names like "李".
// Dots only between letters ("Sam Jr." -> "samjr", not "samjr."), like the
// server's setup needs (household.pb.js).
function usernameFor(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return clean.length >= 2 ? clean.slice(0, 30).replace(/\.+$/, "") : "me";
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

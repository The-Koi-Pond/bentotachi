import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { errorMessage } from "../pb";
import {
  backUpPhone,
  lastBackup,
  phoneAccount,
  restorePhone,
  switchToServer,
  takeRestoredBackupNote,
  type BackupNote,
} from "../phoneMode";
import { daysAgo } from "../backupReminder";
import { formatDay, localToday } from "../dates";
import { BenMood } from "../Brand";

// Restoring reloads the app, so "Restored" is kept across the reload here.
const JUST_RESTORED_KEY = "bento.justRestored";

function takeJustRestored(): boolean {
  try {
    const restored = sessionStorage.getItem(JUST_RESTORED_KEY) === "1";
    sessionStorage.removeItem(JUST_RESTORED_KEY);
    return restored;
  } catch {
    return false;
  }
}

// ⋮ → Backups, on a phone-only Bento (see phoneMode.ts): everything lives on
// this phone, so this is where it's saved somewhere safe, restored, or moved
// to a real server.
export default function Backups() {
  const [status, setStatus] = useState<BackupNote | null>(null);
  const [busy, setBusy] = useState(false);
  // The login is only for moving to a server, so it stays out of sight
  // until asked for (phone-only users never need an account otherwise).
  const [showLogin, setShowLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const account = phoneAccount();
  const [last, setLast] = useState(lastBackup);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (takeJustRestored()) setStatus({ text: "Restored from the backup.", isError: false });
  }, []);

  // A backup saved while Android had closed Bentotachi arrives as
  // "#/backups?result=1" (see noteRestoredBackup in phoneMode.ts).
  const result = searchParams.get("result") === "1";
  useEffect(() => {
    if (!result) return;
    setSearchParams({}, { replace: true });
    const note = takeRestoredBackupNote();
    if (!note) return;
    setStatus(note);
    setLast(lastBackup());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  async function backUp() {
    setBusy(true);
    setStatus(null);
    try {
      if (await backUpPhone()) {
        setStatus({ text: "Backup saved.", isError: false });
        setLast(lastBackup());
      }
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!window.confirm("Replace everything in Bentotachi on this phone with a backup? What's here now will be gone.")) return;
    setBusy(true);
    setStatus(null);
    try {
      // Start afresh with the restored data (logging in again if needed).
      if (await restorePhone()) {
        try {
          sessionStorage.setItem(JUST_RESTORED_KEY, "1");
        } catch {
          // Restored all the same; just no message after the reload.
        }
        window.location.reload();
      } else setBusy(false);
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
      setBusy(false);
    }
  }

  return (
    <div className="stack narrow">
      <h1>Backups</h1>
      <p>
        Bentotachi is running on this phone only. Your recipes, photos, lists and plans are kept here and nowhere else, so if
        the phone is lost or Bentotachi is uninstalled, they're gone, unless you've saved a backup.
      </p>

      <section className="card stack">
        <h2>Save a backup</h2>
        <p className="muted">Everything in one file. Save it somewhere off this phone, like Google Drive.</p>
        <p className={last ? "small-note" : "small-note warning-text"}>
          {last
            ? `Last saved ${daysAgo(new Date(), last)} (${formatDay(localToday(last), { weekday: "short", day: "numeric", month: "short" })}).`
            : "No backup saved from this phone yet."}
        </p>
        <button className="button primary" onClick={() => void backUp()} disabled={busy}>
          Save a backup
        </button>
        {status &&
          (status.isError ? (
            <p className="error">{status.text}</p>
          ) : (
            <div className="with-ben">
              <BenMood mood="halo" small />
              <p className="success">{status.text}</p>
            </div>
          ))}
      </section>

      <section className="card stack">
        <h2>Restore a backup</h2>
        <p className="muted">Replaces everything in Bentotachi on this phone with a backup file you pick.</p>
        <button className="button" onClick={() => void restore()} disabled={busy}>
          Restore a backup…
        </button>
      </section>

      <section className="card stack">
        <h2>Joining a household</h2>
        <p className="muted">
          Sharing with your household needs a server (like a Raspberry Pi at home). If someone already runs one, tap “Join a
          household” and log in with the account they made you.
        </p>
        <p className="muted">
          To bring everything from this phone to a new server instead: whoever runs it restores your backup from its admin
          page (Settings → Backups). Then tap “Join a household”, type its address, and log in with the login Bentotachi
          made for you here.
        </p>
        {account && (
          <button className="link-button" aria-expanded={showLogin} onClick={() => setShowLogin((value) => !value)}>
            {showLogin ? "Hide my login" : "Here's your login"}
          </button>
        )}
        {account && showLogin && (
          <dl className="login-details">
            <div>
              <dt>Username</dt>
              <dd>{account.username}</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>
                {showPassword ? <code className="phone-password">{account.password}</code> : "••••••••"}{" "}
                <button className="link-button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </dd>
            </div>
            <div>
              <dt>Server's admin page</dt>
              <dd>
                {account.username}@bento.local, same password
              </dd>
            </div>
          </dl>
        )}
        <button className="button ghost end-button" onClick={switchToServer} disabled={busy}>
          Join a household
        </button>
      </section>
    </div>
  );
}

import { useState } from "react";
import { errorMessage } from "../pb";
import { backUpPhone, lastBackup, leavePhoneMode, phoneAccount, restorePhone } from "../phoneMode";
import { daysAgo } from "../backupReminder";
import { formatDay, localToday } from "../dates";
import { BenMood } from "../Brand";

// ⋮ → Backups, on a phone-only Bento (see phoneMode.ts): everything lives on
// this phone, so this is where it's saved somewhere safe, restored, or moved
// to a real server.
export default function Backups() {
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const account = phoneAccount();
  const [last, setLast] = useState(lastBackup);

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
      if (await restorePhone()) window.location.reload();
      else setBusy(false);
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
      setBusy(false);
    }
  }

  function switchToServer() {
    if (!window.confirm("Switch to a server? Bentotachi's data stays on this phone, in case you come back to it.")) return;
    leavePhoneMode();
    window.location.reload();
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
        <h2>Moving to a server</h2>
        <p className="muted">
          To share Bentotachi with your household, it needs a server (like a Raspberry Pi at home). A backup from here works
          on a new one: whoever runs it restores your backup from its admin page (Settings → Backups). Then tap “Switch to
          a server” below, type its address, and log in with:
        </p>
        {account && (
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
        <button className="button ghost push-left" onClick={switchToServer} disabled={busy}>
          Switch to a server
        </button>
      </section>
    </div>
  );
}

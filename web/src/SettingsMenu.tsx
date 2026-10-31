import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { displayName, errorMessage, isAndroidApp, pb, personStyle, useCurrentUser, useQuickMinutes } from "./pb";
import { useWakeLock } from "./useWakeLock";
import { useShelfDrawers } from "./shelfDrawers";
import { useSingleUser } from "./household";
import Avatar from "./Avatar";
import { ChevronIcon, MoreIcon } from "./icons";
import { forgetOfflineCopy } from "./offline";
import { canSelfUpdate, checkForUpdate, installUpdate, useUpdateState, type UpdateState } from "./appUpdates";

// The small line under "Check for updates".
function updateDetail(update: UpdateState): string {
  switch (update.status) {
    case "checking":
      return "Checking…";
    case "current":
      return `Up to date (Bento ${update.installed})`;
    case "available":
      return `You have ${update.installed}`;
    case "installing":
      return "Downloading…";
    case "error":
      return update.message;
    default:
      return "";
  }
}

// The ⋮ button in the top bar: your profile (picture, name, color and the
// rest) at the top, then this device's settings. Lives for the whole session,
// so "Keep screen on" stays on while moving between recipes.
export default function SettingsMenu() {
  const user = useCurrentUser();
  const wakeLock = useWakeLock();
  const drawers = useShelfDrawers();
  const singleUser = useSingleUser();
  const update = useUpdateState();
  const quickMinutes = useQuickMinutes();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when tapping anywhere else or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="menu" ref={menuRef}>
      <button
        className="icon-button"
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="menu-panel" role="menu">
          {user && (
            <Link to="/profile" role="menuitem" className="menu-profile" onClick={() => setOpen(false)}>
              <Avatar user={user} size={40} />
              <span className="menu-item-text">
                <span className="person-name" style={personStyle(user)}>
                  {displayName(user)}
                </span>
                <span className="menu-item-detail">Profile, color and password</span>
              </span>
              <ChevronIcon />
            </Link>
          )}
          {/* The app's server can change (PC now, Pi later); log out to change it. */}
          {isAndroidApp && <p className="menu-note">Server: {pb.baseURL.replace(/^https?:\/\//, "")}</p>}
          {user && (
            <Link to="/household" role="menuitem" className="menu-link" onClick={() => setOpen(false)}>
              {singleUser ? "Share Bento" : "Household"}
              <span className="menu-item-detail">{singleUser ? "Add someone to use it with you" : "Who has an account; add someone"}</span>
            </Link>
          )}
          {user && <QuickSetting userId={user.id} value={quickMinutes} />}
          {wakeLock.supported && (
            <button role="menuitemcheckbox" aria-checked={wakeLock.on} onClick={wakeLock.toggle}>
              Keep screen on
              <span className="switch" aria-hidden="true" />
            </button>
          )}
          <button role="menuitemcheckbox" aria-checked={drawers.startClosed} onClick={() => drawers.setStartClosed(!drawers.startClosed)}>
            <span className="menu-item-text">
              Categories start closed
              <span className="menu-item-detail">Each time you open Bento</span>
            </span>
            <span className="switch" aria-hidden="true" />
          </button>
          {canSelfUpdate && (
            <button
              role="menuitem"
              onClick={() => void (update.status === "available" ? installUpdate() : checkForUpdate())}
              disabled={update.status === "checking" || update.status === "installing"}
            >
              <span className="menu-item-text">
                {update.status === "available" ? `Update to ${update.latest.versionName}` : "Check for updates"}
                <span className="menu-item-detail">{updateDetail(update)}</span>
              </span>
            </button>
          )}
          <button
            role="menuitem"
            onClick={() => {
              forgetOfflineCopy();
              pb.authStore.clear();
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

const QUICK_CHOICES = [10, 15, 20, 25, 30, 40, 45, 60, 90];

// "Quick means: 30 min or less". Saved on your account, so it's the same on
// every device you use. Recipes at or under it get the ⚡ badge.
function QuickSetting({ userId, value }: { userId: string; value: number }) {
  const [error, setError] = useState("");
  const choices = QUICK_CHOICES.includes(value) ? QUICK_CHOICES : [...QUICK_CHOICES, value].sort((a, b) => a - b);

  async function change(minutes: number) {
    setError("");
    try {
      // Updating your own account also refreshes the logged-in copy, so the
      // ⚡ badges change straight away.
      await pb.collection("users").update(userId, { quick_minutes: minutes });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <label className="menu-setting">
      <span>
        Quick means
        {error && <span className="menu-item-detail error">{error}</span>}
      </span>
      <select value={value} onChange={(e) => void change(Number(e.target.value))}>
        {choices.map((minutes) => (
          <option key={minutes} value={minutes}>
            {minutes} min or less
          </option>
        ))}
      </select>
    </label>
  );
}

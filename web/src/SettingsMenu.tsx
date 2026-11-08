import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { displayName, errorMessage, isAndroidApp, pb, personStyle, useCurrentUser, useQuickMinutes } from "./pb";
import { useWakeLock } from "./useWakeLock";
import { useShelfDrawers } from "./shelfDrawers";
import { useStepAmounts } from "./stepAmountsSetting";
import { useSingleUser, useSpell } from "./household";
import Avatar from "./Avatar";
import { ChevronIcon, MoreIcon } from "./icons";
import { forgetOfflineCopy } from "./offline";
import { isPhoneMode, switchToServer } from "./phoneMode";
import {
  canSelfUpdate,
  checkForUpdate,
  installUpdate,
  restartToUpdate,
  updatesFromPlay,
  useUpdateState,
  type UpdateState,
} from "./appUpdates";
import deki from "./assets/deki.svg";

// The small line under "Check for updates".
function updateDetail(update: UpdateState): string {
  switch (update.status) {
    case "checking":
      return "Checking…";
    case "current":
      return `Up to date (Bentotachi ${update.installed})`;
    case "available":
      return `You have ${update.installed}`;
    case "installing":
      return "Downloading…";
    case "downloaded":
      return "Downloaded, ready to install";
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
  const [stepAmounts, setStepAmounts] = useStepAmounts();
  const singleUser = useSingleUser();
  const spell = useSpell();
  const update = useUpdateState();
  const quickMinutes = useQuickMinutes();
  const phone = isPhoneMode();
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
                <span className="menu-item-detail">
                  {spell(phone ? "Name, picture and colour" : "Profile, colour and password")}
                </span>
              </span>
              <ChevronIcon />
            </Link>
          )}
          {/* The app's server can change (PC now, Pi later); log out to change it. */}
          {isAndroidApp && !phone && <p className="menu-note">Server: {pb.baseURL.replace(/^https?:\/\//, "")}</p>}
          {/* Phone-only: nobody else can reach it, so backups instead of sharing. */}
          {phone && (
            <Link to="/backups" role="menuitem" className="menu-link" onClick={() => setOpen(false)}>
              Backups
              <span className="menu-item-detail">Save or restore a backup</span>
            </Link>
          )}
          {user && !phone && (
            <Link to="/household" role="menuitem" className="menu-link" onClick={() => setOpen(false)}>
              {singleUser ? "Share Bentotachi" : "Household"}
              <span className="menu-item-detail">
                {singleUser ? "Add someone to use it with you; country, spoons, meals" : "Who has an account; country, spoons, meals"}
              </span>
            </Link>
          )}
          {/* Phone-only: the Household page is just its settings. */}
          {user && phone && (
            <Link to="/household" role="menuitem" className="menu-link" onClick={() => setOpen(false)}>
              Country, spoons & meals
              <span className="menu-item-detail">For store search, recipe hints and the plan</span>
            </Link>
          )}
          {user && (
            <Link to="/export" role="menuitem" className="menu-link" onClick={() => setOpen(false)}>
              Import & export
              <span className="menu-item-detail">Bring recipes from Paprika and other apps, or save a copy</span>
            </Link>
          )}
          {user && <QuickSetting userId={user.id} value={quickMinutes} />}
          {user && <AccountSwitch userId={user.id} field="show_nutrition" on={!!user.show_nutrition} label="Show nutrition" />}
          {/* Only where the server knows the setting (an older one doesn't
              send it, and would ignore the switch). */}
          {user && user.website_step_photos !== undefined && (
            <AccountSwitch
              userId={user.id}
              field="website_step_photos"
              on={user.website_step_photos}
              label="Bring step photos"
              detail="When saving from a website, if it has them"
            />
          )}
          {wakeLock.supported && (
            <button role="menuitemcheckbox" aria-checked={wakeLock.on} onClick={wakeLock.toggle}>
              Keep screen on
              <span className="switch" aria-hidden="true" />
            </button>
          )}
          <button role="menuitemcheckbox" aria-checked={stepAmounts} onClick={() => setStepAmounts(!stepAmounts)}>
            <span className="menu-item-text">
              Amounts in the method
              <span className="menu-item-detail">“Add the oregano (1 tsp)”, when it's sure</span>
            </span>
            <span className="switch" aria-hidden="true" />
          </button>
          <button role="menuitemcheckbox" aria-checked={drawers.startClosed} onClick={() => drawers.setStartClosed(!drawers.startClosed)}>
            <span className="menu-item-text">
              Shelves start closed
              <span className="menu-item-detail">Each time you open Bentotachi</span>
            </span>
            <span className="switch" aria-hidden="true" />
          </button>
          {/* The household's app updates from its server, which phone-only
              mode doesn't have; Play's updates don't need one. */}
          {((canSelfUpdate && !phone) || updatesFromPlay) && (
            <button
              role="menuitem"
              onClick={() =>
                void (update.status === "available"
                  ? installUpdate()
                  : update.status === "downloaded"
                    ? restartToUpdate()
                    : checkForUpdate())
              }
              disabled={update.status === "checking" || update.status === "installing"}
            >
              <span className="menu-item-text">
                {update.status === "available"
                  ? update.latest.versionName
                    ? `Update to ${update.latest.versionName}`
                    : "Update Bentotachi"
                  : update.status === "downloaded"
                    ? "Restart to update"
                    : "Check for updates"}
                <span className="menu-item-detail">{updateDetail(update)}</span>
              </span>
            </button>
          )}
          {/* The tip link: never in the Google Play app (docs/VISION.md), which
              is the build that can't update itself. */}
          {(!isAndroidApp || canSelfUpdate) && (
            <a
              href="https://ko-fi.com/bentotachi"
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="menu-link"
              onClick={() => setOpen(false)}
            >
              <span>
                Support Bentotachi <span aria-hidden="true">♡</span>
              </span>
              <span className="menu-item-detail">Free forever, but I wouldn't say no to a coffee</span>
            </a>
          )}
          {/* Phone-only Bento logs itself in, so instead of Log out (where
              people look for a way out), the way to the household's server. */}
          {phone && (
            <button role="menuitem" onClick={switchToServer}>
              <span className="menu-item-text">
                Join a household
                <span className="menu-item-detail">Use the Bentotachi someone at home runs</span>
              </span>
            </button>
          )}
          {!phone && (
            <button
              role="menuitem"
              onClick={() => {
                forgetOfflineCopy();
                pb.authStore.clear();
              }}
            >
              Log out
            </button>
          )}
          {/* The studio credit every Koi Pond app carries, with Deki (the
              studio's mascot). Fine in every build, Google Play's included. */}
          <a
            href="https://thekoipond.dev/"
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className="menu-credit"
            onClick={() => setOpen(false)}
          >
            <img src={deki} alt="" width="22" height="23" />A Koi Pond app
          </a>
        </div>
      )}
    </div>
  );
}

// A switch saved on your account (so it's the same on every device), like
// "Quick means", that says so when it couldn't be saved (no connection,
// say). "Show nutrition": recipes' nutrition facts, off unless chosen, as
// some people would rather not see them. "Bring step photos from websites":
// a recipe saved from a link also brings its steps' photos (import.pb.js),
// off unless chosen, as they take room on the server or phone.
function AccountSwitch({
  userId,
  field,
  on,
  label,
  detail,
}: {
  userId: string;
  field: "show_nutrition" | "website_step_photos";
  on: boolean;
  label: string;
  detail?: string;
}) {
  const [error, setError] = useState("");

  async function toggle() {
    setError("");
    try {
      await pb.collection("users").update(userId, { [field]: !on });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <button role="menuitemcheckbox" aria-checked={on} onClick={() => void toggle()}>
      <span className="menu-item-text">
        {label}
        {error ? <span className="menu-item-detail error">{error}</span> : detail && <span className="menu-item-detail">{detail}</span>}
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
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

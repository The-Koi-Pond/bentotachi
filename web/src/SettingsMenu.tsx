import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { displayName, personStyle, useCurrentUser } from "./pb";
import { useWakeLock } from "./useWakeLock";
import { useSpell } from "./household";
import Avatar from "./Avatar";
import { ChevronIcon, MoreIcon } from "./icons";
import { isPhoneMode } from "./phoneMode";
import { updateAction, updateDetail, updateLabel, useUpdateState } from "./appUpdates";

// The ⋮ button in the top bar: only what you reach for mid-task (docs/
// VISION.md, "The ⋮ menu and Settings"). Your profile at the top (with the
// household and logging out), Keep screen on, Settings for the rest, and an
// update once one is waiting. Lives for the whole session, so "Keep screen
// on" stays on while moving between recipes.
export default function SettingsMenu() {
  const user = useCurrentUser();
  const wakeLock = useWakeLock();
  const spell = useSpell();
  const update = useUpdateState();
  const phone = isPhoneMode();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateWaiting = update.status === "available" || update.status === "downloaded" || update.status === "installing";

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
                  {spell(phone ? "Name, picture, colour and household" : "Profile, household and logging out")}
                </span>
              </span>
              <ChevronIcon />
            </Link>
          )}
          {wakeLock.supported && (
            <button role="menuitemcheckbox" aria-checked={wakeLock.on} onClick={wakeLock.toggle}>
              <span className="menu-item-text">
                Keep screen on
                <span className="menu-item-detail">While you cook</span>
              </span>
              <span className="switch" aria-hidden="true" />
            </button>
          )}
          <Link to="/settings" role="menuitem" className="menu-link" onClick={() => setOpen(false)}>
            Settings
            <span className="menu-item-detail">Recipes, import and export, updates</span>
          </Link>
          {updateWaiting && (
            <button role="menuitem" onClick={() => void updateAction(update)} disabled={update.status === "installing"}>
              <span className="menu-item-text">
                {updateLabel(update)}
                <span className="menu-item-detail">{updateDetail(update)}</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

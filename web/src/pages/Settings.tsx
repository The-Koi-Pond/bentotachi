import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { errorMessage, isAndroidApp, pb, useCurrentUser, useQuickMinutes, users } from "../pb";
import { useShelfDrawers } from "../shelfDrawers";
import { useStepAmounts } from "../stepAmountsSetting";
import { isPhoneMode } from "../phoneMode";
import { ChevronIcon } from "../icons";
import { canSelfUpdate, updateAction, updateDetail, updateLabel, updatesFromPlay, useUpdateState } from "../appUpdates";
import deki from "../assets/deki.svg";
import HouseholdSettings from "../HouseholdSettings";
import { chooseTheme, useThemeChoice, type ThemeChoice } from "../theme";

// ⋮ → Settings: what you set once and rarely touch, in bento trays by
// what it's about (docs/VISION.md, "The ⋮ menu and Settings"). The menu
// keeps only what you reach for mid-task.
export default function Settings() {
  const user = useCurrentUser();
  const drawers = useShelfDrawers();
  const [stepAmounts, setStepAmounts] = useStepAmounts();
  const quickMinutes = useQuickMinutes();
  const phone = isPhoneMode();
  // The household's app updates from its server, which phone-only mode
  // doesn't have; Play's updates don't need one.
  const updates = (canSelfUpdate && !phone) || updatesFromPlay;
  const server = isAndroidApp && !phone;

  return (
    <div className="stack narrow">
      <h1>Settings</h1>

      <section className="stack tray-section">
        <h2>Appearance</h2>
        <ul className="settings-list">
          <li>
            <ThemeSetting />
          </li>
        </ul>
      </section>

      <section className="stack tray-section">
        <h2>Recipes</h2>
        <ul className="settings-list">
          {user && (
            <li>
              <QuickSetting userId={user.id} value={quickMinutes} />
            </li>
          )}
          {user && (
            <li>
              <AccountSwitch userId={user.id} field="show_nutrition" on={!!user.show_nutrition} label="Show nutrition" />
            </li>
          )}
          <li>
            <Switch on={stepAmounts} onToggle={() => setStepAmounts(!stepAmounts)} label="Amounts in the method" detail="“Add the oregano (1 tsp)”, when it's sure" />
          </li>
          {/* Only where the server knows the setting (an older one doesn't
              send it, and would ignore the switch). */}
          {user && user.website_step_photos !== undefined && (
            <li>
              <AccountSwitch
                userId={user.id}
                field="website_step_photos"
                on={user.website_step_photos}
                label="Bring step photos"
                detail="When saving from a website, if it has them"
              />
            </li>
          )}
          <li>
            <Switch
              on={drawers.startClosed}
              onToggle={() => drawers.setStartClosed(!drawers.startClosed)}
              label="Shelves start closed"
              detail="Each time you open Bentotachi"
            />
          </li>
        </ul>
      </section>

      <HouseholdSettings />

      <section className="stack tray-section">
        <h2>Your data</h2>
        <ul className="settings-list">
          <li>
            <LinkRow to="/export" label="Import & export" detail="Bring recipes from Paprika and other apps, or save a copy" />
          </li>
          {phone && (
            <li>
              <LinkRow to="/backups" label="Backups" detail="Save or restore a backup" />
            </li>
          )}
        </ul>
      </section>

      {(updates || server) && (
        <section className="stack tray-section">
          <h2>App</h2>
          <ul className="settings-list">
            {/* The app's server can change (PC now, Pi later); log out to change it. */}
            {server && (
              <li className="setting-row">
                <span className="menu-item-text">
                  Server
                  <span className="menu-item-detail">{pb.baseURL.replace(/^https?:\/\//, "")}</span>
                </span>
              </li>
            )}
            {updates && (
              <li>
                <UpdateRow />
              </li>
            )}
          </ul>
        </section>
      )}

      {/* The studio credit every Koi Pond app carries, with Deki (the
          studio's mascot), out of the way at the very bottom. Fine in every
          build, Google Play's included. */}
      <a href="https://thekoipond.dev/" target="_blank" rel="noopener noreferrer" className="settings-credit">
        <img src={deki} alt="" width="22" height="23" />A Koi Pond app
      </a>
    </div>
  );
}

// Light or dark, on this device: Auto follows the phone's (or computer's)
// own setting.
const THEMES: { choice: ThemeChoice; label: string }[] = [
  { choice: "auto", label: "Auto" },
  { choice: "light", label: "Light" },
  { choice: "dark", label: "Dark" },
];

function ThemeSetting() {
  const theme = useThemeChoice();
  return (
    <div className="setting-row">
      <span className="menu-item-text">
        Light or dark
        <span className="menu-item-detail">Auto follows your device</span>
      </span>
      <div className="view-switch" role="group" aria-label="Light or dark">
        {THEMES.map(({ choice, label }) => (
          <button key={choice} type="button" aria-pressed={theme === choice} onClick={() => chooseTheme(choice)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LinkRow({ to, label, detail }: { to: string; label: string; detail: string }) {
  return (
    <Link to={to} className="setting-row">
      <span className="menu-item-text">
        {label}
        <span className="menu-item-detail">{detail}</span>
      </span>
      <ChevronIcon />
    </Link>
  );
}

// An on/off setting: the whole row is the switch.
function Switch({ on, onToggle, label, detail }: { on: boolean; onToggle: () => void; label: string; detail?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="setting-row" onClick={onToggle}>
      <span className="menu-item-text">
        {label}
        {detail && <span className="menu-item-detail">{detail}</span>}
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

// A switch saved on your account (so it's the same on every device), that
// says so when it couldn't be saved (no connection, say). "Show nutrition":
// recipes' nutrition facts, off unless chosen, as some people would rather
// not see them. "Bring step photos": a recipe saved from a link also brings
// its steps' photos (import.pb.js), off unless chosen, as they take room on
// the server or phone.
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
      await users().update(userId, { [field]: !on });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return <Switch on={on} onToggle={() => void toggle()} label={label} detail={error ? <span className="error">{error}</span> : detail} />;
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
      await users().update(userId, { quick_minutes: minutes });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <label className="setting-row">
      <span className="menu-item-text">
        Quick means
        {error ? <span className="menu-item-detail error">{error}</span> : <span className="menu-item-detail">Recipes this fast get the ⚡</span>}
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

// "Check for updates", or the update it found.
function UpdateRow() {
  const update = useUpdateState();
  return (
    <button
      type="button"
      className="setting-row"
      onClick={() => void updateAction(update)}
      disabled={update.status === "checking" || update.status === "installing"}
    >
      <span className="menu-item-text">
        {updateLabel(update)}
        <span className="menu-item-detail">{updateDetail(update)}</span>
      </span>
    </button>
  );
}

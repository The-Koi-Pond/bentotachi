import { useState } from "react";
import { Link } from "react-router";
import { backupReminder, snoozeUntil } from "./backupReminder";
import { isPhoneMode, lastBackup } from "./phoneMode";
import { remember, remembered } from "./phoneStorage";

const SNOOZE_KEY = "bento.backupSnoozed";

function snoozed(): Date | null {
  const saved = remembered(SNOOZE_KEY);
  return saved ? new Date(saved) : null;
}

// On the Recipes page of a phone-only Bento: "Save a backup" when there's
// none yet, or the last one is old (see backupReminder.ts).
export default function BackupNudge({ recipes }: { recipes: number }) {
  const [hidden, setHidden] = useState(false);
  if (!isPhoneMode() || hidden) return null;
  const now = new Date();
  const reminder = backupReminder(now, lastBackup(), snoozed(), recipes);
  if (!reminder) return null;

  function later() {
    remember(SNOOZE_KEY, snoozeUntil(new Date()).toISOString());
    setHidden(true);
  }

  return (
    <div className="offline-note backup-nudge" role="status">
      <span>
        <strong>{reminder.kind === "never" ? "No backup yet." : `Last backup ${reminder.days} days ago.`}</strong> Your
        recipes are only on this phone. Save a backup somewhere else, like Google Drive.
      </span>
      <span className="nudge-actions">
        <button className="button small ghost" onClick={later}>
          Later
        </button>
        <Link to="/backups" className="button small primary">
          Back up
        </Link>
      </span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { installUpdate, restartToUpdate, startUpdateChecks, useUpdateState } from "./appUpdates";

// "Bentotachi 1.3 is ready [Update] [Later]" at the top of the app, when the
// server (or, in the Google Play app, Play) has a newer Android app than
// this one. Play's downloads end with "Restart to update".
export default function UpdateBanner() {
  const update = useUpdateState();
  // "Later" hides it until the next new version, or until a Play download
  // finishes (that's news too).
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => startUpdateChecks(), []);

  const latest = "latest" in update ? update.latest : undefined;
  const downloaded = update.status === "downloaded";
  const key = latest ? `${latest.versionCode}${downloaded ? "-downloaded" : ""}` : "";
  if (!latest || dismissed === key) return null;
  const installing = update.status === "installing";
  // Play doesn't say the version's name.
  const name = latest.versionName ? `Bentotachi ${latest.versionName}` : "A new version of Bentotachi";

  return (
    <div className="update-banner" role="status">
      <p>
        <strong>{downloaded ? "The update has downloaded." : `${name} is out of the oven.`}</strong>
        {latest.notes && <span className="muted"> {latest.notes}</span>}
      </p>
      {update.status === "error" && <p className="error">{update.message}</p>}
      <div className="actions">
        <button className="button ghost small" onClick={() => setDismissed(key)}>
          Later
        </button>
        {downloaded ? (
          <button className="button primary small" onClick={() => void restartToUpdate()}>
            Restart to update
          </button>
        ) : (
          <button className="button primary small" onClick={() => void installUpdate()} disabled={installing}>
            {installing ? "Downloading…" : "Update"}
          </button>
        )}
      </div>
    </div>
  );
}

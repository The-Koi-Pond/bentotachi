import { useEffect, useState } from "react";
import { installUpdate, startUpdateChecks, useUpdateState } from "./appUpdates";

// "Bento 1.3 is ready [Update] [Later]" at the top of the app, when the
// server has a newer Android app than this one.
export default function UpdateBanner() {
  const update = useUpdateState();
  // "Later" hides it until the next new version.
  const [dismissedVersion, setDismissedVersion] = useState<number | null>(null);

  useEffect(() => startUpdateChecks(), []);

  const latest = "latest" in update ? update.latest : undefined;
  if (!latest || dismissedVersion === latest.versionCode) return null;
  const installing = update.status === "installing";

  return (
    <div className="update-banner" role="status">
      <p>
        <strong>Bento {latest.versionName} is ready.</strong>
        {latest.notes && <span className="muted"> {latest.notes}</span>}
      </p>
      {update.status === "error" && <p className="error">{update.message}</p>}
      <div className="actions">
        <button className="button ghost small" onClick={() => setDismissedVersion(latest.versionCode)}>
          Later
        </button>
        <button className="button primary small" onClick={() => void installUpdate()} disabled={installing}>
          {installing ? "Downloading…" : "Update"}
        </button>
      </div>
    </div>
  );
}

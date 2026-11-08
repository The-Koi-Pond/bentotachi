import {
  AppUpdateAvailability,
  FlexibleUpdateInstallStatus,
  type AppUpdateInfo,
} from "@capawesome/capacitor-app-update";

// What Google Play's answer about updates means for the update banner in
// the Play app (appUpdates.ts). Its own module so it can be tested
// (web/test/playUpdates.test.ts): the expected answers are what Play's
// docs say it reports, which only an install from Play can confirm.
export type PlayUpdateStatus = "current" | "available" | "installing" | "downloaded";

export function playUpdateStatus(
  info: Pick<AppUpdateInfo, "updateAvailability" | "installStatus" | "flexibleUpdateAllowed">
): PlayUpdateStatus {
  // A finished download waits for "Restart to update", whatever else Play says.
  if (info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) return "downloaded";
  const busy = [
    FlexibleUpdateInstallStatus.PENDING,
    FlexibleUpdateInstallStatus.DOWNLOADING,
    FlexibleUpdateInstallStatus.INSTALLING,
  ];
  if (
    (info.installStatus !== undefined && busy.includes(info.installStatus)) ||
    info.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS
  )
    return "installing";
  // On purpose: an update Play only allows full screen ("immediate") isn't
  // offered; Bentotachi's uploads never ask Play for that kind.
  if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE && info.flexibleUpdateAllowed) return "available";
  return "current";
}

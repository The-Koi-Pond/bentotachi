import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { AppUpdate, AppUpdateResultCode, FlexibleUpdateInstallStatus } from "@capawesome/capacitor-app-update";
import { useSyncExternalStore } from "react";
import { errorMessage, isAndroidApp, pb } from "./pb";
import { playUpdateStatus, type PlayUpdateStatus } from "./playUpdates";

// Updates for the Android app, two ways. The household's own app updates
// itself: the server says which version is the newest (published by "npm
// run release"); if it's newer, a banner offers to install it. The Google
// Play app may not install its own updates, so Play does: the same banner
// asks Play for its in-app update ("flexible": it downloads while the app
// is in use, then "Restart to update" installs it).

interface BentoUpdaterPlugin {
  install(options: { url: string }): Promise<void>;
}

const BentoUpdater = registerPlugin<BentoUpdaterPlugin>("BentoUpdater");

interface Release {
  versionCode: number;
  // Play only says the version code, so these are "" there.
  versionName: string;
  notes: string;
}

export type UpdateState =
  | { status: "idle" | "checking" }
  | { status: "current"; installed: string }
  | { status: "available"; installed: string; latest: Release }
  // Downloading (Play) or opening Android's installer (the household's app).
  | { status: "installing"; installed: string; latest: Release }
  // Play only: downloaded, waiting for "Restart to update".
  | { status: "downloaded"; installed: string; latest: Release }
  | { status: "error"; message: string; installed?: string; latest?: Release };

// One shared state for the banner and the settings menu.
let state: UpdateState = { status: "idle" };
const listeners = new Set<() => void>();

function setState(next: UpdateState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribe, () => state);
}

// The Google Play app never updates itself (Play's rules: Play does it), and
// has no tip link. "npm run play" builds it with VITE_BENTO_PLAY=1
// (scripts/play.mjs).
export const canSelfUpdate = isAndroidApp && import.meta.env.VITE_BENTO_PLAY !== "1";
export const updatesFromPlay = isAndroidApp && import.meta.env.VITE_BENTO_PLAY === "1";

// While Play's "Update?" dialog is open, a check (the app resumes when it
// closes) would race its answer.
let playDialogOpen = false;

// Asks Play afresh and shows its answer, which is "available" or not. Each
// answer can start an update only once (the plugin forgets it after an
// attempt), so every attempt asks again.
async function askPlay(): Promise<PlayUpdateStatus | null> {
  // The banner stays as it is while a download runs or waits, rather than
  // flickering to "checking" on every return to the app.
  if (state.status !== "installing" && state.status !== "downloaded") setState({ status: "checking" });
  let installed = "";
  try {
    installed = (await App.getInfo()).version;
    const info = await AppUpdate.getAppUpdateInfo();
    const latest = { versionCode: Number(info.availableVersionCode) || 0, versionName: "", notes: "" };
    const status = playUpdateStatus(info);
    setState(status === "current" ? { status, installed } : { status, installed, latest });
    return status;
  } catch (err) {
    // Play's own reasons read like "Install Error(-10)", and a copy not
    // installed from Play always gets one, so the reason is logged and
    // only the ⋮ menu's small line says it failed (the banner needs an
    // update to show).
    console.warn("Asking Google Play about updates failed", errorMessage(err));
    setState({ status: "error", message: "Couldn't ask Google Play about updates. Try again later.", installed });
    return null;
  }
}

export async function checkForUpdate() {
  if (state.status === "checking") return;
  if (updatesFromPlay) {
    // A download Play runs is checked on every return to the app (Google's
    // advice: the "downloaded" news can be missed in the background, and a
    // reopened app never hears it), so only the dialog holds a check back.
    if (!playDialogOpen) await askPlay();
    return;
  }
  if (state.status === "installing" || !canSelfUpdate) return;
  setState({ status: "checking" });
  let installed = "";
  try {
    const info = await App.getInfo();
    installed = info.version;
    const latest = await pb.send<Release>("/api/cookbook/app/latest", {});
    setState(
      latest.versionCode > Number(info.build)
        ? { status: "available", installed, latest }
        : { status: "current", installed }
    );
  } catch (err) {
    // 404: nothing published yet, so this app is as new as it gets.
    if ((err as { status?: number }).status === 404) setState({ status: "current", installed });
    else setState({ status: "error", message: errorMessage(err), installed });
  }
}

export async function installUpdate() {
  if (state.status !== "available" && !(state.status === "error" && state.latest)) return;
  const { installed, latest } = state as { installed: string; latest: Release };
  setState({ status: "installing", installed, latest });
  if (updatesFromPlay) {
    playDialogOpen = true;
    try {
      // A fresh answer first: it may also say the update already
      // downloaded (then the banner offers "Restart to update").
      const fresh = await askPlay();
      // Play unreachable just now: keep the banner, with the reason, so
      // Update can be tapped again.
      if (fresh === null) {
        setState({ status: "error", message: "Couldn't reach Google Play. Try again later.", installed, latest });
        return;
      }
      if (fresh !== "available") return;
      setState({ status: "installing", installed, latest });
      // Play asks the person first; once they agree it downloads in the
      // background, and its progress arrives through the listener in
      // startUpdateChecks.
      const { code } = await AppUpdate.startFlexibleUpdate();
      if (code === AppUpdateResultCode.CANCELED) setState({ status: "available", installed, latest });
      else if (code !== AppUpdateResultCode.OK) setState({ status: "error", message: "Google Play couldn't start the update. Try again later.", installed, latest });
    } catch (err) {
      console.warn("Starting the Play update failed", errorMessage(err));
      setState({ status: "error", message: "Google Play couldn't start the update. Try again later.", installed, latest });
    } finally {
      playDialogOpen = false;
    }
    return;
  }
  try {
    await BentoUpdater.install({ url: pb.buildURL("/api/cookbook/app/download") });
    // Android's installer is now on screen; Bento restarts once it's done.
    setState({ status: "available", installed, latest });
  } catch (err) {
    setState({ status: "error", message: errorMessage(err), installed, latest });
  }
}

// Play only: install the downloaded update. Play shows its install screen
// and reopens Bentotachi afterwards.
export async function restartToUpdate() {
  if (state.status !== "downloaded") return;
  try {
    await AppUpdate.completeFlexibleUpdate();
  } catch (err) {
    console.warn("Finishing the Play update failed", errorMessage(err));
    setState({ status: "error", message: "Google Play couldn't finish the update. Try again later.", installed: state.installed, latest: state.latest });
  }
}

// Check once logged in, and whenever the app comes back to the front.
let started = false;
export function startUpdateChecks() {
  if (!(canSelfUpdate || updatesFromPlay) || started) return;
  started = true;
  if (updatesFromPlay) {
    void AppUpdate.addListener("onFlexibleUpdateStateChange", ({ installStatus }) => {
      const current = state;
      // Mid-check there's no update in hand yet: ask again for the news.
      if (!("latest" in current) || !current.latest || !current.installed) {
        if (installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) void checkForUpdate();
        return;
      }
      const { installed, latest } = current;
      if (installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) setState({ status: "downloaded", installed, latest });
      // A check that ran just as the download began may have said "available".
      else if (installStatus === FlexibleUpdateInstallStatus.PENDING || installStatus === FlexibleUpdateInstallStatus.DOWNLOADING) {
        if (current.status !== "installing") setState({ status: "installing", installed, latest });
      } else if (installStatus === FlexibleUpdateInstallStatus.FAILED) {
        // After "Restart to update" it's the install that failed.
        const what = current.status === "downloaded" ? "install" : "download";
        setState({ status: "error", message: `The update didn't ${what}. Try again later.`, installed, latest });
      } else if (installStatus === FlexibleUpdateInstallStatus.CANCELED) setState({ status: "available", installed, latest });
    });
  }
  void checkForUpdate();
  void App.addListener("resume", () => void checkForUpdate());
}

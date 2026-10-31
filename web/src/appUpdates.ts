import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import { errorMessage, isAndroidApp, pb } from "./pb";

// Self-updating for the Android app. The server says which version is the
// newest (published by "npm run release"); if it's newer than this app,
// a banner offers to install it.

interface BentoUpdaterPlugin {
  install(options: { url: string }): Promise<void>;
}

const BentoUpdater = registerPlugin<BentoUpdaterPlugin>("BentoUpdater");

interface Release {
  versionCode: number;
  versionName: string;
  notes: string;
}

export type UpdateState =
  | { status: "idle" | "checking" }
  | { status: "current"; installed: string }
  | { status: "available"; installed: string; latest: Release }
  | { status: "installing"; installed: string; latest: Release }
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

export const canSelfUpdate = isAndroidApp;

export async function checkForUpdate() {
  if (!isAndroidApp || state.status === "checking" || state.status === "installing") return;
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
  try {
    await BentoUpdater.install({ url: pb.buildURL("/api/cookbook/app/download") });
    // Android's installer is now on screen; Bento restarts once it's done.
    setState({ status: "available", installed, latest });
  } catch (err) {
    setState({ status: "error", message: errorMessage(err), installed, latest });
  }
}

// Check once logged in, and whenever the app comes back to the front.
let started = false;
export function startUpdateChecks() {
  if (!isAndroidApp || started) return;
  started = true;
  void checkForUpdate();
  void App.addListener("resume", () => void checkForUpdate());
}

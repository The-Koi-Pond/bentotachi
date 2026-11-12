import { LocalNotifications } from "@capacitor/local-notifications";
import { isAndroidApp } from "./pb";
import { localToday } from "./dates";
import { remember, remembered } from "./phoneStorage";
import { askFirst } from "./askFirst";
import type { StepTimer, TimerAlert } from "./stepTimers";

// Step timers that ring with the phone locked or Bentotachi in the
// background, where they used to stay silent until the app was opened.
// While a timer runs, Android holds a notification for the moment it
// reaches zero, so it rings whether or not the app is running. Only in the
// Android app; in a browser the tray's own beep is all there is.
//
// On time needs Android's "Alarms & reminders" permission, which Android
// 14 and newer don't give by themselves. Bentotachi asks at the first timer
// of a day until it's allowed (at most once a day, so a "no" isn't asked
// again straight away, nor forever final), and
// otherwise settles for "roughly on time" (Android may hold the
// notification back a long while to save battery).

const CHANNEL = "step-timers";
// The day it last asked, like "2026-11-08".
const ASKED_KEY = "bento.timerAlarmsAskedOn";

// Notifications are numbered; a timer's id is text ("1762560000000-k3x9a").
function notificationId(timer: Pick<StepTimer, "id">): number {
  let hash = 0;
  for (const char of timer.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 2_000_000_000) + 1;
}

let channel: Promise<void> | null = null;
function timersChannel(): Promise<void> {
  channel ??= LocalNotifications.createChannel({
    id: CHANNEL,
    name: "Step timers",
    description: "When a recipe step's timer reaches zero",
    // High: it sounds and shows on top, like an alarm clock's.
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch(() => {
    channel = null;
  });
  return channel;
}

function askedToday(): boolean {
  return remembered(ASKED_KEY) === localToday();
}

function rememberAsked() {
  remember(ASKED_KEY, localToday());
}

// Holds a notification for when the timer reaches zero. `ask`: whether
// this is someone starting a timer (so Android's questions may come up),
// rather than resuming one. Says how it'll ring: "exact" on time, "inexact"
// roughly, or undefined for not at all (no permission, a browser, paused).
export async function holdAlert(timer: StepTimer, ask: boolean): Promise<TimerAlert | undefined> {
  if (!isAndroidApp || timer.endsAt === null) return undefined;
  try {
    let allowed = (await LocalNotifications.checkPermissions()).display;
    if (allowed !== "granted" && ask) allowed = (await LocalNotifications.requestPermissions()).display;
    if (allowed !== "granted") return undefined;

    let exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted";
    if (!exact && ask && !askedToday()) {
      rememberAsked();
      if (
        await askFirst(
          "Want timers to ring on time when the phone is locked? Android will open a settings page: turn on “Allow setting alarms and reminders”, then come back.",
          { yes: "Open settings", no: "Not now" }
        )
      ) {
        exact = (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === "granted";
      }
    }

    await timersChannel();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId(timer),
          // The heading too ("Sauce, step 1"), as two steps can share a number.
          title: `Time's up: ${timer.heading ? `${timer.heading}, step` : "step"} ${timer.step} (${timer.label})`,
          body: timer.recipeTitle,
          channelId: CHANNEL,
          smallIcon: "ic_stat_timer",
          schedule: { at: new Date(timer.endsAt), allowWhileIdle: true },
          // Never the plugin's own trip to Android's settings: asked above.
          isExactNotification: exact,
          extra: { recipeId: timer.recipeId },
        },
      ],
    });
    return exact ? "exact" : "inexact";
  } catch {
    // No notification: the tray still beeps while Bentotachi is open.
    return undefined;
  }
}

// Whether the timer's notification has already shown (rung), so the tray
// needn't beep as well. False when it can't tell.
export async function alertShown(timer: Pick<StepTimer, "id">): Promise<boolean> {
  if (!isAndroidApp) return false;
  try {
    const { notifications } = await LocalNotifications.getDeliveredNotifications();
    return notifications.some((n) => n.id === notificationId(timer));
  } catch {
    return false;
  }
}

// Takes the timer's notification back: waiting (paused or stopped) or
// already showing (dismissed in the tray, or rung in the app instead).
export function dropAlert(timer: Pick<StepTimer, "id">) {
  if (!isAndroidApp) return;
  const notifications = [{ id: notificationId(timer) }];
  void LocalNotifications.cancel({ notifications }).catch(() => {});
  void LocalNotifications.removeDeliveredNotifications({
    notifications: notifications.map((n) => ({ ...n, title: "", body: "" })),
  }).catch(() => {});
}

// Every timer's notification, waiting or showing: "Delete everything" forgets
// the timers, so nothing could take theirs back later.
export async function dropAllAlerts() {
  if (!isAndroidApp) return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) });
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch {
    // Notifications not allowed or not there: nothing to take back.
  }
}

// Tapping a timer's notification opens its recipe.
if (isAndroidApp) {
  void LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
    const recipeId = (notification.extra as { recipeId?: string } | undefined)?.recipeId;
    if (recipeId) window.location.hash = `#/recipes/${recipeId}`;
  }).catch(() => {});
}

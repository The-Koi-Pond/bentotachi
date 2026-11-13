// Timers in a recipe's method: "Simmer for 10 minutes" gets a "⏱ 10 min"
// to tap. This file finds the times in a step and keeps the countdowns;
// StepTimerTray.tsx shows them. A countdown keeps when it ends rather than
// ticking, so it stays right while the page is left or the phone sleeps.

import { NUMBER, parseNumber } from "./weights.ts";

export interface StepTime {
  // How it's shown on the button: "10 min", "10–15 min", "1 h 30 min".
  label: string;
  // What the timer counts down from: the shorter end of a range ("10–15
  // minutes" is checked at 10).
  seconds: number;
}

const UNIT = String.raw`(hours?|hrs?|h|minutes?|mins?|seconds?|secs?)`;
const AMOUNT = new RegExp(String.raw`(?<!\d)(?<!\d[.,])(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?\s*-?\s*${UNIT}\.?(?![a-z])`, "gi");
// Said in words.
const WORDS: [RegExp, number][] = [
  [/\bhalf an hour\b/i, 1800],
  [/\b(?:an|one) hour\b/i, 3600],
  [/\b(?:a|one) minute\b/i, 60],
];

const secondsPer = (unit: string) => (/^h/i.test(unit) ? 3600 : /^m/i.test(unit) ? 60 : 1);

// "1 h 30 min", "45 min", "30 sec", "1½ h".
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const parts = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s || !parts.length) parts.push(`${s} sec`);
  return parts.join(" ");
}

interface Found extends StepTime {
  start: number;
  end: number;
  unit: string;
  range: boolean;
}

// The times a step mentions, in order, without repeats.
export function stepTimes(step: string): StepTime[] {
  const found: Found[] = [];
  for (const match of step.matchAll(AMOUNT)) {
    const per = secondsPer(match[3]);
    const low = parseNumber(match[1]) * per;
    const high = match[2] ? parseNumber(match[2]) * per : null;
    // "1-1/2 hours" is one and a half, not 1 to ½ (as weights.ts reads it).
    const mixed = high !== null && high < low && parseNumber(match[2]) < 1;
    const seconds = mixed ? low + high : low;
    const range = high !== null && !mixed;
    const unitWord = per === 3600 ? "h" : per === 60 ? "min" : "sec";
    const label = range ? `${match[1].trim()}–${match[2].trim()} ${unitWord}` : formatDuration(seconds);
    found.push({ label, seconds, start: match.index, end: match.index + match[0].length, unit: unitWord, range });
  }
  // "1 hour 30 minutes", "1 hr and 15 mins": one time, not two.
  const merged: Found[] = [];
  for (const time of found) {
    const last = merged[merged.length - 1];
    const between = last ? step.slice(last.end, time.start) : "";
    if (last && last.unit === "h" && time.unit === "min" && !last.range && !time.range && /^\s*(?:and\s+)?$/i.test(between)) {
      const seconds = last.seconds + time.seconds;
      merged[merged.length - 1] = { ...last, seconds, label: formatDuration(seconds), end: time.end, unit: "min" };
    } else merged.push(time);
  }
  const times: StepTime[] = merged.map(({ label, seconds }) => ({ label, seconds }));
  for (const [pattern, seconds] of WORDS) if (!times.length && pattern.test(step)) times.push({ label: formatDuration(seconds), seconds });
  return times.filter((time, i) => time.seconds > 0 && times.findIndex((other) => other.seconds === time.seconds) === i);
}

// A countdown started from a step.
export interface StepTimer {
  id: string;
  recipeId: string;
  recipeTitle: string;
  // The step's number, as shown in the method.
  step: number;
  // Which step it is, by its place in recipe.steps: numbers start again
  // after a # heading, so two steps can share one. Missing on timers saved
  // before it was kept.
  stepIndex?: number;
  // The # heading the step is under ("Sauce"), to tell apart two "Step 1"s.
  heading?: string;
  label: string;
  // When it reaches zero (ms since 1970), or null while paused.
  endsAt: number | null;
  // Time left while paused, in ms.
  leftMs: number;
  // Whether it has already beeped for reaching zero.
  rang: boolean;
  // How Android's notification will ring it while it runs (timerAlerts.ts):
  // on time, roughly, or (missing) not at all.
  alert?: TimerAlert;
}

export type TimerAlert = "exact" | "inexact";

// A timer that reached zero this long ago or less did so with Bentotachi on
// screen (the tray ticks every second); longer ago, it was in the
// background or the phone was locked.
export const JUST_ENDED_MS = 10_000;

// Whether the tray beeps for a timer that reached zero, now that Bentotachi
// is on screen. Always when it just ended: the tray's beep plays at media
// volume, while Android's notification is silent on a phone set to silent
// or Do Not Disturb; the notification is taken back
// straight after. Ended a while ago, only if Android's notification hasn't
// already rung it (a late one would otherwise ring twice).
export function beepsInApp(msSinceEnd: number, notificationShown: boolean): boolean {
  return msSinceEnd <= JUST_ENDED_MS || !notificationShown;
}

// A step with a timer, where the method shows it.
export interface TimedStep {
  index: number; // in recipe.steps
  number: number; // as the method shows it
  heading: string; // the # heading it's under, or ""
}

export function startStepTimer(recipeId: string, recipeTitle: string, step: TimedStep, time: StepTime, now: number): StepTimer {
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    recipeId,
    recipeTitle,
    step: step.number,
    stepIndex: step.index,
    ...(step.heading ? { heading: step.heading } : {}),
    label: time.label,
    endsAt: now + time.seconds * 1000,
    leftMs: time.seconds * 1000,
    rang: false,
  };
}

// Whether this step's timer for this time is counting down, so its button
// says so. A timer saved before timers kept their step's place goes by the
// step's number, as it did then.
export function runsForStep(timer: StepTimer, recipeId: string, step: Pick<TimedStep, "index" | "number">, label: string): boolean {
  if (timer.recipeId !== recipeId || timer.label !== label || timer.rang) return false;
  return timer.stepIndex === undefined ? timer.step === step.number : timer.stepIndex === step.index;
}

export function remaining(timer: StepTimer, now: number): number {
  return timer.endsAt === null ? timer.leftMs : Math.max(0, timer.endsAt - now);
}

// The screen stays on while a timer counts down and for a little after one
// ends, so the finished timer is on screen when you walk over, not a phone
// that dimmed as it started beeping. A paused one doesn't keep it on.
export const AWAKE_AFTER_END_MS = 2 * 60_000;

export function keepsScreenOn(timers: StepTimer[], now: number): boolean {
  return timers.some((timer) => timer.endsAt !== null && now < timer.endsAt + AWAKE_AFTER_END_MS);
}

// Paused, it has no notification waiting (resuming holds a new one).
export function pausedTimer(timer: StepTimer, now: number): StepTimer {
  return timer.endsAt === null ? timer : { ...timer, endsAt: null, leftMs: remaining(timer, now), alert: undefined };
}

export function resumedTimer(timer: StepTimer, now: number): StepTimer {
  return timer.endsAt !== null ? timer : { ...timer, endsAt: now + timer.leftMs };
}

// "9:58", "1:05:00".
export function countdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

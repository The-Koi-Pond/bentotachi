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
  label: string;
  // When it reaches zero (ms since 1970), or null while paused.
  endsAt: number | null;
  // Time left while paused, in ms.
  leftMs: number;
  // Whether it has already beeped for reaching zero.
  rang: boolean;
}

export function startStepTimer(recipeId: string, recipeTitle: string, step: number, time: StepTime, now: number): StepTimer {
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    recipeId,
    recipeTitle,
    step,
    label: time.label,
    endsAt: now + time.seconds * 1000,
    leftMs: time.seconds * 1000,
    rang: false,
  };
}

export function remaining(timer: StepTimer, now: number): number {
  return timer.endsAt === null ? timer.leftMs : Math.max(0, timer.endsAt - now);
}

export function pausedTimer(timer: StepTimer, now: number): StepTimer {
  return timer.endsAt === null ? timer : { ...timer, endsAt: null, leftMs: remaining(timer, now) };
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

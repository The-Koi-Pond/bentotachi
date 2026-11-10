// Timing a recipe while cooking it, to find out how long its prep and cook
// really take: a stopwatch in two stages (prep, then cook), with pause.
// It keeps start times rather than ticking, so it stays right while the
// phone is locked or the page is closed (it's saved on this device; see
// RecipeTimer.tsx).

import { extraTimes } from "./format.ts";

type TimerStage = "prep" | "cook" | "done";

export interface TimerState {
  stage: TimerStage;
  // Time already counted in each stage, in milliseconds.
  prepMs: number;
  cookMs: number;
  // When the stage now running started counting, or null while paused.
  runningSince: number | null;
}

export function startTimer(now: number): TimerState {
  return { stage: "prep", prepMs: 0, cookMs: 0, runningSince: now };
}

// The time counted so far in the stage that's running.
function counted(state: TimerState, now: number): number {
  return state.runningSince === null ? 0 : Math.max(0, now - state.runningSince);
}

// Each stage's time so far.
export function elapsed(state: TimerState, now: number): { prep: number; cook: number } {
  return {
    prep: state.prepMs + (state.stage === "prep" ? counted(state, now) : 0),
    cook: state.cookMs + (state.stage === "cook" ? counted(state, now) : 0),
  };
}

export function paused(state: TimerState, now: number): TimerState {
  if (state.runningSince === null || state.stage === "done") return state;
  const { prep, cook } = elapsed(state, now);
  return { ...state, prepMs: prep, cookMs: cook, runningSince: null };
}

export function resumed(state: TimerState, now: number): TimerState {
  if (state.runningSince !== null || state.stage === "done") return state;
  return { ...state, runningSince: now };
}

// Prep done (or skipped): the cook stage starts counting now.
export function startCooking(state: TimerState, now: number): TimerState {
  const { prep } = elapsed(state, now);
  return { stage: "cook", prepMs: prep, cookMs: state.cookMs, runningSince: now };
}

export function finished(state: TimerState, now: number): TimerState {
  const { prep, cook } = elapsed(state, now);
  return { stage: "done", prepMs: prep, cookMs: cook, runningSince: null };
}

// A running clock: "8:05", "1:02:09".
export function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

// Minutes to save as the recipe's time, the way recipes write them: to the
// nearest minute under 10, the nearest 5 after that. Any time at all is at
// least a minute; none is 0 (no prep).
export function recipeMinutes(ms: number): number {
  if (ms < 30_000) return ms > 0 ? 1 : 0;
  const minutes = ms / 60_000;
  return minutes < 10 ? Math.max(1, Math.round(minutes)) : Math.round(minutes / 5) * 5;
}

// The total to save with newly timed prep and cook. Extra times like "Cool
// 7 h" aren't timed, so they stay in it; so does any waiting a website gave
// only in its total (prep 15, cook 20, total 4 h 35 min), which would
// otherwise turn a slow recipe into a quick one.
export function timedTotal(
  recipe: { prep_minutes: number; cook_minutes: number; total_minutes: number; extra_times?: unknown },
  prep: number,
  cook: number,
): number {
  const extra = extraTimes(recipe).reduce((sum, time) => sum + time.minutes, 0);
  const waiting = Math.max(0, recipe.total_minutes - recipe.prep_minutes - recipe.cook_minutes - extra);
  return prep + cook + extra + waiting;
}

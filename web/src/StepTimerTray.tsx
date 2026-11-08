import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { CloseIcon } from "./icons";
import { alertShown, dropAlert, holdAlert } from "./timerAlerts";
import {
  JUST_ENDED_MS,
  beepsInApp,
  countdown,
  pausedTimer,
  remaining,
  resumedTimer,
  startStepTimer,
  type StepTime,
  type StepTimer,
} from "./stepTimers";

// The countdowns started from recipe steps (stepTimers.ts), in a small tray
// above the tab bar on every page, so they carry on while you look at
// something else. Kept on this device. When one reaches zero with
// Bentotachi on screen, it beeps and buzzes here. In the background or with
// the phone locked, the Android app's notification rings it
// (timerAlerts.ts); without one (a browser, or notifications not allowed)
// it beeps when Bentotachi is opened again, and ⋮ → Keep screen on helps.

const KEY = "bento.stepTimers";

function load(): StepTimer[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

let timers: StepTimer[] = load();
const listeners = new Set<() => void>();

function set(next: StepTimer[]) {
  timers = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept if the page closes; it still runs while it's open.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStepTimers(): StepTimer[] {
  return useSyncExternalStore(subscribe, () => timers);
}

export function startTimer(recipeId: string, recipeTitle: string, step: number, time: StepTime) {
  const timer = startStepTimer(recipeId, recipeTitle, step, time, Date.now());
  set([...timers, timer]);
  // Browsers only let a page make sound after a tap: this tap unlocks it.
  void audio()?.resume();
  hold(timer, true);
}

const update = (id: string, change: (timer: StepTimer) => StepTimer) =>
  set(timers.map((timer) => (timer.id === id ? change(timer) : timer)));

// Android's notification for a timer (timerAlerts.ts), one change at a time
// so a quick pause and resume can't land in the wrong order.
let alerts: Promise<void> = Promise.resolve();
function queue(change: () => Promise<void> | void) {
  alerts = alerts.then(change).catch(() => {});
}

function hold(timer: StepTimer, ask: boolean) {
  queue(async () => {
    const alert = await holdAlert(timer, ask);
    const current = timers.find((t) => t.id === timer.id);
    // Paused, resumed again or stopped while Android was asked.
    if (!current || current.endsAt !== timer.endsAt) {
      if (alert) dropAlert(timer);
    } else if (current.alert !== alert) {
      update(timer.id, (t) => ({ ...t, alert }));
    }
  });
}

// Held again each time Bentotachi starts, as Android now allows: turning
// off "Alarms & reminders" restarts the app and deletes the on-time ones,
// which would leave a running timer silent (found testing, 2026-11-08).
for (const timer of timers) if (timer.endsAt !== null && timer.endsAt > Date.now()) hold(timer, false);

function pauseOrResume(timer: StepTimer) {
  if (timer.endsAt === null) {
    const resumed = resumedTimer(timer, Date.now());
    update(timer.id, () => resumed);
    hold(resumed, false);
  } else {
    update(timer.id, (t) => pausedTimer(t, Date.now()));
    queue(() => dropAlert(timer));
  }
}

function remove(timer: StepTimer) {
  set(timers.filter((t) => t.id !== timer.id));
  queue(() => dropAlert(timer));
}

let context: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    return context;
  } catch {
    return null;
  }
}

// Three short beeps, and a buzz on phones.
function ring() {
  navigator.vibrate?.([400, 150, 400, 150, 400]);
  const ctx = audio();
  if (!ctx) return;
  void ctx.resume();
  for (let i = 0; i < 3; i++) {
    const start = ctx.currentTime + i * 0.35;
    const tone = ctx.createOscillator();
    const volume = ctx.createGain();
    tone.frequency.value = 880;
    volume.gain.setValueAtTime(0.25, start);
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
    tone.connect(volume).connect(ctx.destination);
    tone.start(start);
    tone.stop(start + 0.25);
  }
}

export default function StepTimerTray() {
  const list = useStepTimers();
  const [now, setNow] = useState(() => Date.now());
  const tray = useRef<HTMLDivElement>(null);

  // Ticks once a second while any timer is running.
  const running = list.some((timer) => timer.endsAt !== null && remaining(timer, now) > 0);
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [running]);
  // Back from the background: catch up at once.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Each timer rings once when it reaches zero. In the background, one
  // Android rings on time is left to its notification; the rest wait for
  // Bentotachi to be on screen. On screen, the tray beeps (beepsInApp says
  // when), and the timer's notification is taken back: it has rung, or
  // would ring a second time.
  useEffect(() => {
    const visible = document.visibilityState === "visible";
    const due = list.filter((timer) => !timer.rang && remaining(timer, now) === 0 && (visible || timer.alert === "exact"));
    if (!due.length) return;
    set(timers.map((timer) => (due.some((d) => d.id === timer.id) ? { ...timer, rang: true } : timer)));
    if (!visible) return;
    void (async () => {
      let beep = false;
      for (const timer of due) {
        const since = Date.now() - (timer.endsAt ?? Date.now());
        // Ended a while ago: an on-time notification has rung (tapping it
        // removes it, so asking Android wouldn't tell); a late one has if
        // Android still shows it.
        const shown =
          since > JUST_ENDED_MS && (timer.alert === "exact" || (timer.alert === "inexact" && (await alertShown(timer))));
        if (beepsInApp(since, shown)) beep = true;
        if (timer.alert) queue(() => dropAlert(timer));
      }
      if (beep) ring();
    })();
  }, [list, now]);

  // Room for the tray: toasts float above it and the page can scroll past it.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const element = tray.current;
    if (!element) {
      root.style.removeProperty("--timer-tray-height");
      return;
    }
    const measure = () => root.style.setProperty("--timer-tray-height", `${element.offsetHeight + 8}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--timer-tray-height");
    };
  }, [list.length]);

  if (!list.length) return null;
  return (
    <div className="timer-tray" ref={tray} role="region" aria-label="Timers">
      {list.map((timer) => {
        const left = remaining(timer, now);
        const done = left === 0;
        const isPaused = timer.endsAt === null;
        return (
          <div key={timer.id} className={`timer-row ${done ? "finished" : ""}`}>
            <Link to={`/recipes/${timer.recipeId}`} className="timer-what">
              <span className="timer-recipe">{timer.recipeTitle}</span>
              <span className="timer-step">
                Step {timer.step} · {timer.label}
              </span>
            </Link>
            <span className="timer-left" aria-live={done ? "assertive" : "off"}>
              {done ? "Done!" : countdown(left)}
            </span>
            {!done && (
              <button className="button small" onClick={() => pauseOrResume(timer)}>
                {isPaused ? "Resume" : "Pause"}
              </button>
            )}
            <button
              className="icon-button small"
              onClick={() => remove(timer)}
              aria-label={done ? `Dismiss step ${timer.step}'s timer` : `Stop step ${timer.step}'s timer`}
            >
              <CloseIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { CloseIcon } from "./icons";
import {
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
// something else. Kept on this device. When one reaches zero it beeps and
// buzzes while Bentotachi is open; if the phone was asleep, it beeps when
// it's opened again. (A phone that's locked doesn't run the app, so turn on
// ⋮ → Keep screen on for long ones.)

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
  set([...timers, startStepTimer(recipeId, recipeTitle, step, time, Date.now())]);
  // Browsers only let a page make sound after a tap: this tap unlocks it.
  void audio()?.resume();
}

const update = (id: string, change: (timer: StepTimer) => StepTimer) =>
  set(timers.map((timer) => (timer.id === id ? change(timer) : timer)));
const remove = (id: string) => set(timers.filter((timer) => timer.id !== id));

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

  // Each timer beeps once when it reaches zero.
  useEffect(() => {
    const due = list.filter((timer) => !timer.rang && remaining(timer, now) === 0);
    if (!due.length || document.visibilityState !== "visible") return;
    ring();
    set(timers.map((timer) => (due.some((d) => d.id === timer.id) ? { ...timer, rang: true } : timer)));
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
              <button
                className="button small"
                onClick={() => update(timer.id, (t) => (isPaused ? resumedTimer(t, Date.now()) : pausedTimer(t, Date.now())))}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
            )}
            <button
              className="icon-button small"
              onClick={() => remove(timer.id)}
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

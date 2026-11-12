// A short message at the bottom of the screen after a tap ("Moved to the
// Fridge.", "The scanner isn't ready yet…"), where Undo shows too, then gone
// by itself. One at a time: a new one replaces the last. Not for a form's
// own errors (beside their box) or a page that can't load (it says so
// instead). <Toaster /> (App.tsx) shows it; docs/VISION.md, "Messages".
import { useSyncExternalStore } from "react";
import { announce } from "./announce.ts";

export interface Toast {
  id: number;
  text: string;
  error: boolean;
  // One button at its end, like "Undo"; tapping it also puts the message
  // away.
  action?: { label: string; run: () => void };
  // Another before it, for a next step that's only offered ("+ Use-by").
  extra?: { label: string; run: () => void };
}

// Long enough to read; an error a little longer.
export const TOAST_MS = 4500;
export const ERROR_TOAST_MS = 7000;

let current: Toast | null = null;
let count = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showToast(
  text: string,
  { error = false, action, extra }: { error?: boolean; action?: Toast["action"]; extra?: Toast["extra"] } = {}
) {
  if (!text) return;
  current = { id: ++count, text, error, action, extra };
  startTimer();
  announce(text, { urgent: error });
  emit();
}

function startTimer() {
  clearTimeout(timer);
  if (current) timer = setTimeout(hideToast, current.error ? ERROR_TOAST_MS : TOAST_MS);
}

// While a finger, the mouse or the keyboard is on the message (reaching for
// its Undo), it stays; let go, and it gets its full time again.
export function holdToast() {
  clearTimeout(timer);
}

export function releaseToast() {
  startTimer();
}

export function hideToast() {
  clearTimeout(timer);
  if (!current) return;
  current = null;
  emit();
}

// For a page's old "setError": shows an error, ignores the "" that cleared it.
export function showError(text: string) {
  if (text) showToast(text, { error: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToast(): Toast | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function currentToast(): Toast | null {
  return current;
}

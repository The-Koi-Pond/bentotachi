// A short message at the bottom of the screen after a tap ("Moved to the
// Fridge.", "The scanner isn't ready yet…"), where Undo shows too, then gone
// by itself. One at a time: a new one replaces the last. Not for a form's
// own errors (beside their box) or a page that can't load (it says so
// instead). <Toaster /> (App.tsx) shows it; docs/VISION.md, "Messages".
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  text: string;
  error: boolean;
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

export function showToast(text: string, { error = false }: { error?: boolean } = {}) {
  if (!text) return;
  current = { id: ++count, text, error };
  clearTimeout(timer);
  timer = setTimeout(hideToast, error ? ERROR_TOAST_MS : TOAST_MS);
  emit();
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

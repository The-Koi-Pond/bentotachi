import { useSyncExternalStore } from "react";

// "Amounts in the method" (⋮ menu): whether a recipe's steps show how much
// of each ingredient they name (stepAmounts.ts). Off unless chosen, on this
// device.
const KEY = "bento.stepAmounts";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let on = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStepAmounts(): [boolean, (next: boolean) => void] {
  const current = useSyncExternalStore(subscribe, () => on);
  return [
    current,
    (next) => {
      on = next;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // Not remembered; it's off again next time.
      }
      for (const listener of listeners) listener();
    },
  ];
}

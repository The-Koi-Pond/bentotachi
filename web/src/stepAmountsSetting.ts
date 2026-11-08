import { useSyncExternalStore } from "react";
import { remember, remembered } from "./phoneStorage.ts";

// "Amounts in the method" (⋮ menu): whether a recipe's steps show how much
// of each ingredient they name (stepAmounts.ts). Off unless chosen, on this
// device.
const KEY = "bento.stepAmounts";

let on = remembered(KEY) === "1";
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
      remember(KEY, next ? "1" : "0");
      for (const listener of listeners) listener();
    },
  ];
}

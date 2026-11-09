// Light or dark: Auto (the device's setting, the default), or always one.
// Remembered on this device. The stylesheet's dark parts all sit in
// "@media (prefers-color-scheme: dark)" blocks; choosing Light or Dark turns
// those blocks always off or always on, so no rule needs writing twice.
import { useSyncExternalStore } from "react";
import { remember, remembered } from "./phoneStorage.ts";

export type ThemeChoice = "auto" | "light" | "dark";
const KEY = "bento.theme";
const DARK = "(prefers-color-scheme: dark)";

export function savedTheme(): ThemeChoice {
  const saved = remembered(KEY);
  return saved === "light" || saved === "dark" ? saved : "auto";
}

// A dark-mode block's media for a choice: as written for Auto, "all"
// (always) for Dark, "not all" (never) for Light.
export function themedMedia(original: string, choice: ThemeChoice): string {
  if (choice === "auto" || !original.includes(DARK)) return original;
  return original.replaceAll(DARK, choice === "dark" ? "all" : "not all");
}

// Each dark-mode block's media as the stylesheet wrote it, to go back to.
const written = new WeakMap<CSSMediaRule, string>();
let current: ThemeChoice = "auto";
const listeners = new Set<() => void>();

export function applyTheme(choice: ThemeChoice) {
  current = choice;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // Another site's stylesheet (none today): not ours to theme.
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSMediaRule)) continue;
      const original = written.get(rule) ?? rule.media.mediaText;
      if (!original.includes(DARK)) continue;
      written.set(rule, original);
      rule.media.mediaText = themedMedia(original, choice);
    }
  }
  for (const listener of listeners) listener();
}

export function chooseTheme(choice: ThemeChoice) {
  remember(KEY, choice === "auto" ? null : choice);
  applyTheme(choice);
}

// Whether the app is dark right now, for the few things CSS can't reach
// (the title picture).
const deviceDark = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(DARK) : null;

function isDark(): boolean {
  return current === "dark" || (current === "auto" && !!deviceDark?.matches);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  deviceDark?.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    deviceDark?.removeEventListener("change", listener);
  };
}

export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, isDark);
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => current);
}

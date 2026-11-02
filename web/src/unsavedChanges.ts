import { useEffect, useState } from "react";
import { useBlocker } from "react-router";

// Asking before unsaved changes are lost. Anything being typed into that
// isn't saved yet (a recipe editor, a pantry item, a shelf, a password…)
// calls useUnsavedChanges(true) while it has changes. One guard for the
// whole app (<UnsavedChangesGuard /> in App.tsx) then asks before going to
// another page in Bento (a link, the tabs, the back button or Android's
// back gesture), and the browser warns before reloading or closing the tab.
// The guard needs the app's data router (see App.tsx).

// The editors that have changes right now.
const unsaved = new Set<symbol>();

// Call allowLeaving() just before moving on on purpose, like after saving.
export function useUnsavedChanges(dirty: boolean) {
  const [id] = useState(() => Symbol("editor"));
  useEffect(() => {
    if (!dirty) return;
    unsaved.add(id);
    return () => {
      unsaved.delete(id);
    };
  }, [dirty, id]);
  return {
    allowLeaving: () => {
      unsaved.delete(id);
    },
  };
}

export function UnsavedChangesGuard() {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => unsaved.size > 0 && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("You have changes that aren't saved. Leave without saving them?")) {
      unsaved.clear();
      blocker.proceed();
    } else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    // The browser shows its own "Leave site?" message for this.
    const warn = (event: BeforeUnloadEvent) => {
      if (unsaved.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return null;
}

// For Escape, which closes an editor: asks first if that would lose changes.
export function confirmDiscard(dirty: boolean): boolean {
  return !dirty || window.confirm("Throw away the changes you've made here?");
}

// Whether anything on screen has unsaved changes: for changes that stay on
// the same page but replace a form (the pantry's find box, scanning, or the
// top bar's +), which the guard above doesn't see.
export function hasUnsavedChanges(): boolean {
  return unsaved.size > 0;
}

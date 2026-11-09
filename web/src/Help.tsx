import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { popoverSpot } from "./popoverSpot";

// Tips on how to use something sit behind a small "?" beside what they
// explain (docs/VISION.md, Voice). Tapping it opens a little bubble pointing
// at the "?", over the page rather than pushing it down; tapping anywhere
// else, Escape or the phone's back closes it (the browser's own popover).
// What a box needs and what just happened stay visible instead. Keep the
// button out of a <label>: the label would name the button instead of its box.

// Phones whose browser is too old for popovers get the tip opening right
// under the "?" instead, as it used to.
const canPop = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

export function useHelp() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  return { open, setOpen, id, anchor, toggle: () => setOpen((value) => !value) };
}

type HelpState = ReturnType<typeof useHelp>;

export function HelpButton({ help, label }: { help: HelpState; label: string }) {
  return (
    <button
      ref={help.anchor}
      type="button"
      className="help-button"
      aria-expanded={help.open}
      aria-controls={help.id}
      aria-label={label}
      title={label}
      popoverTarget={canPop ? help.id : undefined}
      onClick={canPop ? undefined : help.toggle}
    >
      ?
    </button>
  );
}

export function HelpBox({ help, children }: { help: HelpState; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const { open, setOpen, anchor } = help;

  // Beside its "?", kept on screen; again when the page scrolls or turns.
  const place = useCallback(() => {
    const bubble = box.current;
    const button = anchor.current;
    if (!bubble || !button) return;
    const at = button.getBoundingClientRect();
    const spot = popoverSpot(at, { width: bubble.offsetWidth, height: bubble.offsetHeight }, {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
    });
    bubble.style.left = `${spot.left}px`;
    bubble.style.top = `${spot.top}px`;
    bubble.style.setProperty("--pointer", `${spot.pointer}px`);
    bubble.classList.toggle("above", spot.above);
  }, [anchor]);

  useEffect(() => {
    if (!canPop || !open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  if (!canPop) {
    if (!open) return null;
    return (
      <div id={help.id} className="help-box">
        {children}
      </div>
    );
  }
  return (
    <div
      ref={box}
      id={help.id}
      className="help-box help-pop"
      popover="auto"
      onToggle={(event) => setOpen(event.newState === "open")}
    >
      {children}
    </div>
  );
}

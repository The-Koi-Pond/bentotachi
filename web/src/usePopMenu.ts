// A small menu panel opened from a button (the recipe's ⋯, a grip's moves):
// placed on the screen from the button, below it or, without room there,
// above it, kept clear of the top bar, the tab bar and the timers' tray, and
// no taller than the space between them. Closes on a tap outside, Escape, or
// the page moving. Its panel carries `menu-panel pop-menu` (shell.css).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { pageScrollTarget } from "./pageScroll";

// `align`: which of the button's edges the panel lines up with. `T`: the
// element around the button and its panel.
export function usePopMenu<T extends HTMLElement = HTMLDivElement>({ align = "right" }: { align?: "left" | "right" } = {}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  // Around the button and its panel: a tap inside doesn't close it.
  const menuRef = useRef<T>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    const button = buttonRef.current?.getBoundingClientRect();
    if (!button) return;
    const width = Math.min(300, window.innerWidth - 32);
    const from = align === "right" ? button.right - width : button.left;
    const left = Math.max(16, Math.min(from, window.innerWidth - 16 - width));
    // The floor: the tab bar's top, or the running timers' tray above it.
    const tabbar = document.querySelector(".tabbar")?.getBoundingClientRect().top ?? window.innerHeight;
    const tray = document.querySelector(".timer-tray")?.getBoundingClientRect().top ?? window.innerHeight;
    const topbar = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
    const below = Math.min(tabbar, tray) - button.bottom - 12;
    const above = button.top - topbar - 12;
    // Both edges set: the panel's usual rule (.menu-panel) gives it a top.
    setPlace(
      below >= 260 || below >= above
        ? { left, width, top: button.bottom + 6, bottom: "auto", maxHeight: below }
        : { left, width, top: "auto", bottom: window.innerHeight - button.top + 6, maxHeight: above }
    );
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Only this menu: a cancelled Escape doesn't also close a popover
      // it sits in ("Edit places…").
      event.preventDefault();
      setOpen(false);
    };
    // It's placed on the screen, not the page, so moving the page closes it.
    const onMove = () => setOpen(false);
    // So does turning the phone, but not the keyboard going away (only the
    // height changes), which leaving a name box beside a grip sets off.
    const width = window.innerWidth;
    const onResize = () => window.innerWidth !== width && setOpen(false);
    const page = pageScrollTarget();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    page.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      page.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return {
    open,
    place,
    menuRef,
    buttonRef,
    close: () => setOpen(false),
    toggle: () => (open ? setOpen(false) : openMenu()),
  };
}

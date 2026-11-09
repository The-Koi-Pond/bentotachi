// The app's screens scroll inside .page-scroll (App.tsx), between the top
// bar and the tab bar so its scrollbar runs beside neither, not the window.
// Code that follows or moves the page's scroll uses this, not
// window.scrollY. Screens outside it (logging in) scroll the window, hence
// the fallbacks.
export function pageScroller(): HTMLElement {
  return document.querySelector<HTMLElement>(".page-scroll") ?? document.documentElement;
}

// What to listen to for that scrolling: the window for the fallback, since
// the page's own scroll is reported there, not on <html>.
export function pageScrollTarget(): HTMLElement | Window {
  return document.querySelector<HTMLElement>(".page-scroll") ?? window;
}

// How far down the screen the scrolling part starts (just under the top
// bar), for turning a spot on screen into a spot on the page.
export function pageScrollStart(): number {
  return document.querySelector<HTMLElement>(".page-scroll")?.getBoundingClientRect().top ?? 0;
}

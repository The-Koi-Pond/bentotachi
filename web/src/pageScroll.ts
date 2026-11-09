// The app's screens scroll inside .page-scroll (App.tsx), which stops at the
// tab bar so its scrollbar doesn't run down beside it, not the window. Code
// that follows or moves the page's scroll uses this, not window.scrollY.
// Screens outside it (logging in) scroll the window, hence the fallback.
export function pageScroller(): HTMLElement {
  return document.querySelector<HTMLElement>(".page-scroll") ?? document.documentElement;
}

// What to listen to for that scrolling: the window for the fallback, since
// the page's own scroll is reported there, not on <html>.
export function pageScrollTarget(): HTMLElement | Window {
  return document.querySelector<HTMLElement>(".page-scroll") ?? window;
}

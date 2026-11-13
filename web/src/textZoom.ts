// How much bigger the phone's text-size setting makes text, as the CSS
// variable --text-zoom on <html> (2 at Android's largest, 1 elsewhere).
// Android's web view enlarges every font size but not rem or em in other
// lengths, so a box sized "1.76em" doesn't grow with its words there;
// sizes that must, multiply by it. Browsers scale rem themselves: 1.
// docs/shared-systems.md, "Styles".

// The enlargement from the root's font size as drawn and one rem as laid
// out; anything unreadable counts as none.
export function zoomFrom(rootFontPx: number, remPx: number): number {
  if (!(rootFontPx > 0) || !(remPx > 0)) return 1;
  return Math.round((rootFontPx / remPx) * 100) / 100;
}

function measure() {
  const root = document.documentElement;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:1rem";
  document.body.append(probe);
  const remPx = probe.getBoundingClientRect().width;
  probe.remove();
  const zoom = zoomFrom(parseFloat(getComputedStyle(root).fontSize), remPx);
  root.style.setProperty("--text-zoom", String(zoom));
}

// Measured now, and again when the screen changes or the app comes back to
// the front (the setting may have changed meanwhile).
export function followTextZoom() {
  measure();
  window.addEventListener("resize", measure);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") measure();
  });
}

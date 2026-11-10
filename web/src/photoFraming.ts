// How a recipe's photo is framed: which part of it stays in view (x and y,
// 0-100, from the left and top) and how far it's zoomed in (1-3). The photo
// file itself is never changed. Set with the photo framer (PhotoFramer.tsx,
// double-tap the photo on a recipe), used everywhere the photo shows.

export interface Framing {
  x: number;
  y: number;
  zoom: number;
}

export const CENTRED: Framing = { x: 50, y: 50, zoom: 1 };
export const MAX_ZOOM = 3;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// The saved framing, or centred if there's none (or it's garbled).
export function framingOf(value: unknown): Framing {
  if (!value || typeof value !== "object") return CENTRED;
  const { x, y, zoom } = value as Record<string, unknown>;
  const number = (n: unknown, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? n : fallback);
  return { x: clamp(number(x, 50), 0, 100), y: clamp(number(y, 50), 0, 100), zoom: clamp(number(zoom, 1), 1, MAX_ZOOM) };
}

export function isCentred(framing: Framing): boolean {
  return framing.x === 50 && framing.y === 50 && framing.zoom === 1;
}

// Moved by a drag: dx and dy are how far it was dragged, as a share of the
// frame's width and height. Dragging the photo right shows more of its left.
export function panned(framing: Framing, dx: number, dy: number): Framing {
  return {
    ...framing,
    x: clamp(framing.x - (dx * 100) / framing.zoom, 0, 100),
    y: clamp(framing.y - (dy * 100) / framing.zoom, 0, 100),
  };
}

export function zoomed(framing: Framing, zoom: number): Framing {
  return { ...framing, zoom: clamp(zoom, 1, MAX_ZOOM) };
}

const percent = (n: number) => `${Math.round(n * 100) / 100}%`;

// Style for an <img> (which already has object-fit: cover). object-position
// keeps the focus point in view. Zooming enlarges the img around that point
// (transform), then clips it back to its own box (clip-path), so it never
// spills over the page, in every browser. The clip is in the img's own
// (unscaled) terms: the part that, once enlarged, fills the box. Its round
// corners follow --photo-radius (set in styles/recipe.css and plan.css), shrunk to match.
export function framingStyle(framing: Framing): Record<string, string> {
  const { x, y, zoom } = framing;
  const style: Record<string, string> = { objectPosition: `${percent(x)} ${percent(y)}` };
  if (zoom > 1) {
    const cut = 1 - 1 / zoom;
    style.transform = `scale(${zoom})`;
    style.transformOrigin = `${percent(x)} ${percent(y)}`;
    style.clipPath = `inset(${percent(y * cut)} ${percent((100 - x) * cut)} ${percent((100 - y) * cut)} ${percent(x * cut)} round calc(var(--photo-radius, 0px) / ${zoom}))`;
  }
  return style;
}

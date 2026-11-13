// The phone's or browser's "reduce motion": scrolls jump instead of gliding,
// and nothing slides that doesn't need to.
export function lessMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

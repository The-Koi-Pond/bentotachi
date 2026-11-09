// Where a "?" tip's bubble goes (Help.tsx): under its "?", or above it when
// there isn't room below, lined up with it but kept on screen, with a little
// pointer aimed at the "?". Tested in web/test/popoverSpot.test.ts.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const EDGE = 8;
const GAP = 8;

export function popoverSpot(
  anchor: Box,
  bubble: { width: number; height: number },
  screen: { width: number; height: number }
): { left: number; top: number; above: boolean; pointer: number } {
  const below = anchor.top + anchor.height + GAP;
  const above = bubble.height + GAP + EDGE <= anchor.top && below + bubble.height + EDGE > screen.height;
  const top = above ? anchor.top - GAP - bubble.height : below;
  // Starts at the "?", moved left as far as needed to stay on screen.
  const widest = screen.width - 2 * EDGE;
  const width = Math.min(bubble.width, widest);
  const left = Math.max(EDGE, Math.min(anchor.left - 12, screen.width - EDGE - width));
  // The pointer: over the "?"'s middle, measured from the bubble's left.
  const pointer = Math.max(12, Math.min(width - 12, anchor.left + anchor.width / 2 - left));
  return { left, top, above, pointer };
}

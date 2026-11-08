// How big each recipe was last made, remembered on this device: scaled from
// 4 to 6 servings, it opens at 6 next time. Kept as
// { recipe id: factor }; "as written" (1) isn't kept.

const KEY = "bento.recipeScales";

type Scales = Record<string, number>;

function read(): Scales {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as Scales) : {};
  } catch {
    return {};
  }
}

// The scales with this recipe's changed: 1 (as written), or anything that
// isn't a sensible size, takes it out.
export function withScale(scales: Scales, id: string, factor: number): Scales {
  const next = { ...scales };
  if (factor === 1 || !Number.isFinite(factor) || factor <= 0) delete next[id];
  else next[id] = factor;
  return next;
}

// This recipe's last size, or 1 (as written).
export function scaleOf(scales: Scales, id: string): number {
  const factor = scales[id];
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}

export function savedScale(id: string): number {
  return scaleOf(read(), id);
}

export function saveScale(id: string, factor: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify(withScale(read(), id, factor)));
  } catch {
    // Not remembered; it opens as written next time.
  }
}

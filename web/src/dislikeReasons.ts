// Thumbs-down reasons: short tags like "baked pineapple".

export const MAX_REASONS = 10;
export const MAX_REASON_LENGTH = 40;

const key = (reason: string) => reason.trim().toLowerCase();

// Adds what was typed to the list. A comma separates several reasons; blank
// ones and repeats (ignoring capitals) are skipped, and the list stops at
// MAX_REASONS.
export function addReasons(list: string[], typed: string): string[] {
  const next = [...list];
  for (const part of typed.split(",")) {
    const reason = part.trim().replace(/\s+/g, " ").slice(0, MAX_REASON_LENGTH);
    if (!reason || next.some((r) => key(r) === key(reason))) continue;
    if (next.length >= MAX_REASONS) break;
    next.push(reason);
  }
  return next;
}

// Reasons someone used on other recipes, most used first, leaving out ones
// already on this list: one-tap suggestions.
export function suggestedReasons(used: string[][], current: string[], limit = 6): string[] {
  const counts = new Map<string, { reason: string; count: number }>();
  for (const reasons of used) {
    for (const reason of reasons) {
      const k = key(reason);
      if (!k) continue;
      const entry = counts.get(k) ?? { reason: reason.trim(), count: 0 };
      entry.count += 1;
      counts.set(k, entry);
    }
  }
  const taken = new Set(current.map(key));
  return [...counts.entries()]
    .filter(([k]) => !taken.has(k))
    .sort(([a, x], [b, y]) => y.count - x.count || a.localeCompare(b))
    .slice(0, limit)
    .map(([, entry]) => entry.reason);
}

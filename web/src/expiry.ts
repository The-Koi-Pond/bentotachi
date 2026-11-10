// Expiry dates are plain calendar dates; see dates.ts for how they're stored.
// (".ts" spelled out so the Node tests in web/test can load this file too.)
import { datePart, dayNumber, localToday } from "./dates.ts";

export { toStoredDate } from "./dates.ts";

// Expired, or this many days or fewer to go, counts as "use soon".
const SOON_DAYS = 3;

export type ExpiryState = "expired" | "soon" | "later";

// "2026-11-02 00:00:00.000Z" -> "2026-11-02" (what a date input uses).
export const expiryDate = datePart;

// Days from today to the expiry: 0 = today, -1 = yesterday. null if no date.
export function daysUntil(stored: string, now = new Date()): number | null {
  const date = expiryDate(stored);
  if (!date) return null;
  return dayNumber(date) - dayNumber(localToday(now));
}

export function expiryState(days: number): ExpiryState {
  if (days < 0) return "expired";
  return days <= SOON_DAYS ? "soon" : "later";
}

// "Expires in 3 days", "Expired yesterday", "Expires 12 Dec"...
export function describeExpiry(stored: string, now = new Date()): string {
  const days = daysUntil(stored, now);
  if (days === null) return "";
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return "Expired yesterday";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= 14) return `Expires in ${days} days`;

  const [year, month, day] = expiryDate(stored).split("-").map(Number);
  const label = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...(year !== now.getFullYear() && { year: "numeric" }),
  });
  return `Expires ${label}`;
}

// The same, short enough for a badge beside the name (the full wording goes
// in its label): "Expired", "Today", "Tomorrow", "3 days", "12 Dec".
export function shortExpiry(stored: string, now = new Date()): string {
  const days = daysUntil(stored, now);
  if (days === null) return "";
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 14) return `${days} days`;
  return describeExpiry(stored, now).replace(/^Expires /, "");
}

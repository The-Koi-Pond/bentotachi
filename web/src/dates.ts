// Plain calendar dates ("2026-11-02"), used for expiry dates and the dinner
// plan. PocketBase stores them as "2026-11-02 00:00:00.000Z"; only the date
// part is ever used, so time zones can't shift anything by a day.

// "2026-11-02 00:00:00.000Z" -> "2026-11-02" (what a date input uses).
export function datePart(stored: string): string {
  return stored ? stored.slice(0, 10) : "";
}

// "2026-11-02" -> what PocketBase stores. Blank stays blank (no date).
export function toStoredDate(date: string): string {
  return date ? `${date} 00:00:00.000Z` : "";
}

// A moment PocketBase stored ("2026-11-07 01:23:45.678Z", like `created`) as
// a Date; an invalid one if blank or unreadable.
export function storedTime(stored: string): Date {
  return new Date(stored ? stored.replace(" ", "T") : NaN);
}

// Today on this device, as "2026-11-02".
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Days since 1970, so dates can be subtracted and compared.
export function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function fromDayNumber(days: number): string {
  return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

// "2026-10-30" + 3 -> "2026-11-02"
export function addDays(date: string, days: number): string {
  return fromDayNumber(dayNumber(date) + days);
}

// Which day a week starts on: Monday almost everywhere, Sunday in the US
// (see firstDayFor).
export type FirstDay = "monday" | "sunday";

export function firstDayFor(country: string): FirstDay {
  return country === "US" ? "sunday" : "monday";
}

// The Monday (or Sunday) on or before the date.
export function weekStart(date: string, firstDay: FirstDay = "monday"): string {
  // 1970-01-01 was a Thursday, so day 0 is Thursday; Monday is 4 days on,
  // Sunday 3.
  const offset = (dayNumber(date) - (firstDay === "sunday" ? 3 : 4) + 7 * 1000) % 7;
  return addDays(date, -offset);
}

// "2026-11-17" -> "2026-11-01"
export function monthStart(date: string): string {
  return `${date.slice(0, 8)}01`;
}

// "2026-11-01" + 2 -> "2027-01-01" (always the 1st of the month).
export function addMonths(date: string, months: number): string {
  const [year, month] = date.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

// "Mon 3 Nov" by default (in the phone's own language); pass other parts,
// like { weekday: "short" }, for just "Mon".
export function formatDay(
  date: string,
  parts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }
): string {
  return new Date(dayNumber(date) * 86_400_000).toLocaleDateString(undefined, { ...parts, timeZone: "UTC" });
}

// Two dates as a range, the way the phone writes them: "8–21 November",
// "29 November – 12 December" (or "Nov 8 – 21" in the US); the year only
// when the range crosses one. `locale` is for tests; the phone's by default.
export function formatRange(from: string, to: string, locale?: string): string {
  const day = (date: string) => new Date(dayNumber(date) * 86_400_000);
  const year = from.slice(0, 4) !== to.slice(0, 4) ? { year: "numeric" as const } : {};
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", ...year, timeZone: "UTC" }).formatRange(day(from), day(to));
}

// How long ago a past date was, in plain words: "today", "yesterday",
// "5 days ago", "2 weeks ago", "3 months ago", "over a year ago".
export function timeAgo(date: string, today: string): string {
  const days = dayNumber(today) - dayNumber(date);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 61) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30.44)} months ago`;
  return "over a year ago";
}

// What the date picker (DatePicker.tsx) shows and reads: a month as weeks of
// days, and a date typed by hand in the phone's own order (14/12/2026 in
// Australia, 12/14/2026 in the US). Dates are plain "2026-12-14" (dates.ts).
// Tested in web/test/calendar.test.ts.
import { addDays, weekStart, type FirstDay } from "./dates.ts";

// The month holding `month` (any day in it) as whole weeks from the first
// day of the week; days outside the month are "" (blank cells).
export function monthWeeks(month: string, firstDay: FirstDay): string[][] {
  const first = `${month.slice(0, 8)}01`;
  const weeks: string[][] = [];
  let day = weekStart(first, firstDay);
  while (weeks.length === 0 || day.slice(0, 7) === first.slice(0, 7)) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day.slice(0, 7) === first.slice(0, 7) ? day : "");
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export type DateOrder = "dmy" | "mdy" | "ymd";

// The order the phone writes a short date in, from its own formatting.
// `locale` is for tests.
export function dateOrder(locale?: string): DateOrder {
  const parts = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric" })
    .formatToParts(new Date(Date.UTC(2026, 11, 14)))
    .map((part) => part.type)
    .filter((type) => type === "day" || type === "month" || type === "year");
  if (parts[0] === "year") return "ymd";
  return parts[0] === "month" ? "mdy" : "dmy";
}

// What the typing box shows as a hint: "dd/mm/yyyy" and so on.
export function orderHint(order: DateOrder): string {
  return { dmy: "dd/mm/yyyy", mdy: "mm/dd/yyyy", ymd: "yyyy/mm/dd" }[order];
}

// A typed date ("14/12/2026", "14.12.26", "14 12 2026") as "2026-12-14", or
// null when it isn't a real day. Two-digit years are this century.
export function readTypedDate(text: string, order: DateOrder): string | null {
  const numbers = text.trim().split(/[^0-9]+/).filter(Boolean).map(Number);
  if (numbers.length !== 3) return null;
  const [a, b, c] = numbers;
  const [day, month, rawYear] = order === "dmy" ? [a, b, c] : order === "mdy" ? [b, a, c] : [c, b, a];
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return null;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // 31/02 rolls over to March in Date maths: not a real day.
  const back = addDays(date, 0);
  return back === date ? date : null;
}

// A date as the picker's typing box shows it, in the phone's order.
export function typedText(date: string, order: DateOrder): string {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return order === "dmy" ? `${day}/${month}/${year}` : order === "mdy" ? `${month}/${day}/${year}` : `${year}/${month}/${day}`;
}

// The years offered when picking one: a good way back (when it was opened)
// and further ahead (tins keep for years), always including `shown`.
export function yearsAround(shown: number, thisYear: number): number[] {
  const from = Math.min(shown, thisYear - 10);
  const to = Math.max(shown, thisYear + 15);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

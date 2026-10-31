// Phone-only Bento keeps everything on the phone, so losing the phone loses
// the recipes unless a backup was saved somewhere else. The Recipes page
// nudges: once there's something worth keeping (a few recipes), if no
// backup was ever saved, or the last one is two weeks old. "Later" waits
// three days. Tested in web/test/backupReminder.test.ts.

export const REMIND_AFTER_DAYS = 14;
export const SNOOZE_DAYS = 3;
const WORTH_KEEPING = 3;
const DAY = 24 * 60 * 60 * 1000;

export type Reminder = { kind: "never" } | { kind: "old"; days: number } | null;

export function backupReminder(now: Date, last: Date | null, snoozedUntil: Date | null, recipes: number): Reminder {
  if (recipes < WORTH_KEEPING) return null;
  if (snoozedUntil && now < snoozedUntil) return null;
  if (!last) return { kind: "never" };
  const days = Math.floor((now.getTime() - last.getTime()) / DAY);
  return days >= REMIND_AFTER_DAYS ? { kind: "old", days } : null;
}

export const snoozeUntil = (now: Date) => new Date(now.getTime() + SNOOZE_DAYS * DAY);

// "today", "yesterday", "5 days ago".
export function daysAgo(now: Date, then: Date): string {
  const days = Math.floor((now.getTime() - then.getTime()) / DAY);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

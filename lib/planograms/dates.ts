// Dates as the planogram screens write them: "Oct 8". Due dates are calendar
// days, so they are read in UTC and never shift with the viewer's time zone.
// Today comes from the store's time zone (lib/time/format.ts `storeToday`);
// moments are shown by `components/time/local-time.tsx`.

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function formatDay(isoDate: string): string {
  return DAY.format(new Date(`${isoDate}T00:00:00Z`));
}

export function dueLabel(dueDate: string, today: string): { text: string; overdue: boolean } {
  const overdue = dueDate < today;
  return { text: overdue ? `Overdue · ${formatDay(dueDate)}` : `Due ${formatDay(dueDate)}`, overdue };
}

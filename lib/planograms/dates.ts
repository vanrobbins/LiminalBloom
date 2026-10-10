// Dates as the planogram screens write them: "Oct 8". Due dates are calendar
// days, so they are read in UTC and never shift with the viewer's time zone.

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function formatDay(isoDate: string): string {
  return DAY.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatMoment(at: Date): string {
  return DAY.format(at);
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dueLabel(dueDate: string, today: string): { text: string; overdue: boolean } {
  const overdue = dueDate < today;
  return { text: overdue ? `Overdue · ${formatDay(dueDate)}` : `Due ${formatDay(dueDate)}`, overdue };
}

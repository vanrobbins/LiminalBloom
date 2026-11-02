// Time as the app shows it (DECISIONS "Time", 10-12): every instant is stored
// in UTC; a moment (a publish, an edit) reads in the device's zone, a shift in
// the store's; a calendar day (a due date) is a plain date and never converts.
// Intl only, no date library. Intl puts a narrow no-break space before AM/PM;
// it becomes a plain space so server and client text match exactly.

const MOMENT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

const plain = (text: string) => text.replace(/[  ]/g, " ");

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function inUserTime(instant: Date, deviceZone: string = deviceTimezone()): string {
  return plain(new Intl.DateTimeFormat("en-US", { ...MOMENT, timeZone: deviceZone }).format(instant));
}

export function zoneAbbreviation(zone: string, at: Date): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortGeneric" }).formatToParts(at).find((p) => p.type === "timeZoneName");
  return part?.value ?? zone;
}

export function inStoreTime(instant: Date, storeZone: string, deviceZone: string = deviceTimezone()): string {
  const text = plain(new Intl.DateTimeFormat("en-US", { ...MOMENT, timeZone: storeZone }).format(instant));
  const store = zoneAbbreviation(storeZone, instant);
  return store === zoneAbbreviation(deviceZone, instant) ? text : `${text} (${store})`;
}

/** The store's calendar date: what "today" and overdue mean (replaces todayIso, which was UTC's date). */
export function storeToday(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Which time zones a store may have (DECISIONS "Time", 10-12): any IANA name
// the runtime knows, US zones first because the stores are American.

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

export const US_ZONES = [
  { zone: "America/Los_Angeles", label: "Pacific" },
  { zone: "America/Denver", label: "Mountain" },
  { zone: "America/Phoenix", label: "Arizona" },
  { zone: "America/Chicago", label: "Central" },
  { zone: "America/New_York", label: "Eastern" },
  { zone: "America/Anchorage", label: "Alaska" },
  { zone: "Pacific/Honolulu", label: "Hawaii" },
] as const;

export type ZoneChoice = { zone: string; label: string };

let known: Set<string> | null = null;
function knownZones(): Set<string> {
  known ??= new Set(Intl.supportedValuesOf("timeZone"));
  return known;
}

export function isTimezone(name: string): boolean {
  return knownZones().has(name);
}

export function zoneLabel(zone: string): string {
  const us = US_ZONES.find((z) => z.zone === zone);
  return us ? `${us.label} (${zone})` : zone.replaceAll("_", " ");
}

export function zoneChoices(query: string): { us: ZoneChoice[]; others: ZoneChoice[] } {
  const words = query.trim().toLowerCase();
  const matches = (c: ZoneChoice) => words === "" || c.label.toLowerCase().includes(words);
  const usZones = new Set<string>(US_ZONES.map((z) => z.zone));
  const us = US_ZONES.map((z) => ({ zone: z.zone, label: zoneLabel(z.zone).replaceAll("_", " ") })).filter(matches);
  const others = [...knownZones()]
    .filter((zone) => !usZones.has(zone))
    .sort()
    .map((zone) => ({ zone, label: zoneLabel(zone) }))
    .filter(matches);
  return { us, others };
}

export function startingZone(device: string | null): string {
  return device && isTimezone(device) ? device : DEFAULT_TIMEZONE;
}

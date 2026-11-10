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

/**
 * The runtime's own spelling of an IANA zone, or null if it is not one. Browsers
 * disagree on names (Firefox says America/Indiana/Indianapolis where Node says
 * America/Indianapolis), so a name is accepted when Intl resolves it, and stored
 * the way this runtime spells it. Region names only: no "PST", no "+05:00", and only
 * zones the picker lists (zoneChoices), so /store can always show the one saved (B5).
 */
export function canonicalZone(name: string): string | null {
  if (!name.includes("/")) return null;
  try {
    const zone = new Intl.DateTimeFormat("en-US", { timeZone: name }).resolvedOptions().timeZone;
    return knownZones().has(zone) ? zone : null;
  } catch {
    return null;
  }
}

export function isTimezone(name: string): boolean {
  return canonicalZone(name) !== null;
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
  return (device && canonicalZone(device)) || DEFAULT_TIMEZONE;
}

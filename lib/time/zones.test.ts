import { describe, expect, it } from "vitest";

import { canonicalZone, DEFAULT_TIMEZONE, isTimezone, startingZone, US_ZONES, zoneChoices, zoneLabel } from "./zones";

describe("time zones", () => {
  it("knows real IANA names and refuses anything else", () => {
    expect(isTimezone("America/Denver")).toBe(true);
    for (const name of ["", "Mars/Olympus", "PST", "+05:00", "UTC"]) expect(isTimezone(name)).toBe(false);
  });

  it("accepts a zone the runtime spells differently, and returns the runtime's spelling", () => {
    // Firefox and Safari say America/Indiana/Indianapolis, Asia/Kolkata, Europe/Kyiv;
    // Node and Chrome list the older names for the same zones. Either must be accepted.
    for (const alias of ["America/Indiana/Indianapolis", "Asia/Kolkata", "Europe/Kyiv", "America/Kentucky/Louisville"]) {
      const canonical = canonicalZone(alias);
      expect(canonical, alias).not.toBeNull();
      expect(isTimezone(alias)).toBe(true);
      expect(canonicalZone(canonical!)).toBe(canonical);
    }
    expect(canonicalZone("america/denver")).toBe("America/Denver");
    expect(canonicalZone("America/Denver")).toBe("America/Denver");
  });

  it("gives no canonical zone for names that are not zones", () => {
    for (const name of ["", "Mars/Olympus", "PST", "+05:00", "not a zone"]) expect(canonicalZone(name)).toBeNull();
    // Real to Intl, but not in the picker's list, so /store could never show it (B5).
    for (const name of ["Etc/GMT+5", "etc/gmt-3"]) expect(canonicalZone(name), name).toBeNull();
  });

  it("lists US zones first, then the rest, narrowed by what's typed", () => {
    const all = zoneChoices("");
    expect(all.us.map((z) => z.zone)).toEqual(US_ZONES.map((z) => z.zone));
    expect(all.others.some((z) => z.zone === "Europe/London")).toBe(true);
    expect(all.others.some((z) => z.zone === "America/Denver")).toBe(false);
    const den = zoneChoices("den");
    expect(den.us.map((z) => z.zone)).toEqual(["America/Denver"]);
    expect(zoneChoices("new york").us.map((z) => z.zone)).toEqual(["America/New_York"]);
    expect(zoneChoices("mountain").us.map((z) => z.zone)).toEqual(["America/Denver"]);
  });

  it("labels zones for people", () => {
    expect(zoneLabel("America/Los_Angeles")).toBe("Pacific (America/Los_Angeles)");
    expect(zoneLabel("America/Argentina/Buenos_Aires")).toBe("America/Argentina/Buenos Aires");
  });

  it("starts from the device's zone when it is a known one", () => {
    expect(startingZone("America/Chicago")).toBe("America/Chicago");
    expect(startingZone("Nowhere/Else")).toBe(DEFAULT_TIMEZONE);
    expect(startingZone(null)).toBe(DEFAULT_TIMEZONE);
    expect(startingZone("America/Indiana/Indianapolis")).toBe(canonicalZone("America/Indiana/Indianapolis"));
  });
});

import { describe, expect, it } from "vitest";

import { DEFAULT_TIMEZONE, isTimezone, startingZone, US_ZONES, zoneChoices, zoneLabel } from "./zones";

describe("time zones", () => {
  it("knows real IANA names and refuses anything else", () => {
    expect(isTimezone("America/Denver")).toBe(true);
    for (const name of ["", "Mars/Olympus", "PST", "america/denver"]) expect(isTimezone(name)).toBe(false);
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
  });
});

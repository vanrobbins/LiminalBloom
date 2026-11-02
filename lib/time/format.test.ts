import { describe, expect, it } from "vitest";

import { inStoreTime, inUserTime, storeToday, zoneAbbreviation } from "./format";

const PACIFIC = "America/Los_Angeles";
const HAWAII = "Pacific/Honolulu";
// 8 pm Pacific on Oct 12 is already Oct 13 in UTC: the old todayIso bug.
const eveningInPortland = new Date("2026-10-13T03:00:00Z");

describe("time", () => {
  it("gives the store's calendar day, not UTC's", () => {
    expect(storeToday(PACIFIC, eveningInPortland)).toBe("2026-10-12");
    expect(storeToday("UTC", eveningInPortland)).toBe("2026-10-13");
  });

  it("turns the day over at the store's own midnight, across DST changes", () => {
    // Nov 1 2026: clocks go back at 2 am PDT (09:00 UTC).
    expect(storeToday(PACIFIC, new Date("2026-11-01T06:59:00Z"))).toBe("2026-10-31");
    expect(storeToday(PACIFIC, new Date("2026-11-01T07:00:00Z"))).toBe("2026-11-01");
    expect(storeToday(PACIFIC, new Date("2026-11-02T07:59:00Z"))).toBe("2026-11-01");
    expect(storeToday(PACIFIC, new Date("2026-11-02T08:00:00Z"))).toBe("2026-11-02");
    // Mar 8 2026: clocks go forward.
    expect(storeToday(PACIFIC, new Date("2026-03-08T07:59:00Z"))).toBe("2026-03-07");
    expect(storeToday(PACIFIC, new Date("2026-03-09T06:59:00Z"))).toBe("2026-03-08");
  });

  it("shows a moment in the device's zone", () => {
    expect(inUserTime(eveningInPortland, HAWAII)).toBe("Oct 12, 5:00 PM");
    expect(inUserTime(eveningInPortland, PACIFIC)).toBe("Oct 12, 8:00 PM");
  });

  it("shows store time, naming the zone only when the device is elsewhere", () => {
    expect(inStoreTime(eveningInPortland, PACIFIC, HAWAII)).toBe("Oct 12, 8:00 PM (PT)");
    expect(inStoreTime(eveningInPortland, PACIFIC, PACIFIC)).toBe("Oct 12, 8:00 PM");
    // Same clock, different name: no label needed.
    expect(inStoreTime(eveningInPortland, PACIFIC, "America/Vancouver")).toBe("Oct 12, 8:00 PM");
  });

  it("names a zone the short way", () => {
    expect(zoneAbbreviation(PACIFIC, eveningInPortland)).toBe("PT");
  });
});

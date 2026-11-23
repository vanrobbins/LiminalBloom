import { describe, expect, it } from "vitest";

import { companyEventText, platformEventText } from "./events-text";

describe("companyEventText", () => {
  it("says who did what, with the names the event kept", () => {
    expect(companyEventText({ event: "region_added", actorName: "Ana", detail: { name: "North" } })).toBe("Ana added the region North");
    expect(companyEventText({ event: "region_renamed", actorName: "Ana", detail: { from: "North", to: "Northeast" } })).toBe("Ana renamed the region North to Northeast");
    expect(companyEventText({ event: "store_moved", actorName: "Ana", detail: { store: "Pioneer Place", from: null, to: "North" } })).toBe("Ana moved Pioneer Place from No region to North");
    expect(companyEventText({ event: "store_added", actorName: "Ana", detail: { store: "Pioneer Place", region: null } })).toBe("Ana added Pioneer Place to No region");
    expect(companyEventText({ event: "company_renamed", actorName: "Ana", detail: { from: "Acme", to: "Acme West" } })).toBe("Ana renamed the company from Acme to Acme West");
  });

  it("does not break on an event it does not know", () => {
    expect(companyEventText({ event: "future_thing", actorName: "Ana", detail: {} })).toBe("Ana made a change");
  });
});

describe("platformEventText", () => {
  it("names Liminal Bloom, the company and the reason, never a person", () => {
    expect(platformEventText({ event: "company_paused", actorName: "Admin Person", detail: {}, reason: "billing question" }, "Acme")).toBe("Liminal Bloom paused Acme: billing question");
    expect(platformEventText({ event: "company_restored", actorName: "Admin Person", detail: {} }, "Acme")).toBe("Liminal Bloom restored Acme");
  });
});

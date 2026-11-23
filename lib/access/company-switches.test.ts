import { describe, expect, it } from "vitest";

import { COMPANY_SWITCHES, COMPANY_SWITCH_TEXT, cleanCompanySwitches, companySummaryLines, isCompanySwitch } from "./company-switches";

describe("company switches", () => {
  it("are the three in the spec, in list order", () => {
    expect(COMPANY_SWITCHES).toEqual(["company.settings", "company.structure", "company.people"]);
  });

  it("each has a label and a sentence that starts with a capital and has no full stop", () => {
    for (const s of COMPANY_SWITCHES) {
      expect(COMPANY_SWITCH_TEXT[s].label.length).toBeGreaterThan(0);
      expect(COMPANY_SWITCH_TEXT[s].can).toMatch(/^[A-Z]/);
      expect(COMPANY_SWITCH_TEXT[s].can).not.toMatch(/\.$/);
    }
  });

  it("isCompanySwitch accepts only listed names (a store switch is not one)", () => {
    expect(isCompanySwitch("company.people")).toBe(true);
    expect(isCompanySwitch("people.manage")).toBe(false);
    expect(isCompanySwitch(7)).toBe(false);
  });

  it("cleanCompanySwitches drops unknown values, keeps list order, adds nothing", () => {
    expect([...cleanCompanySwitches(["company.people", "bogus", "products.edit", "company.settings"])]).toEqual(["company.settings", "company.people"]);
    expect(cleanCompanySwitches("company.people").size).toBe(0);
    expect(cleanCompanySwitches(null).size).toBe(0);
  });

  it("summary lines follow list order", () => {
    expect(companySummaryLines(["company.people", "company.settings"])).toEqual([
      COMPANY_SWITCH_TEXT["company.settings"].can,
      COMPANY_SWITCH_TEXT["company.people"].can,
    ]);
  });
});

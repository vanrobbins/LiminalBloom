import { describe, expect, it } from "vitest";

import { cleanCompanyName, slugifyCompany } from "./request-rules";

describe("cleanCompanyName", () => {
  it("trims and collapses space", () => expect(cleanCompanyName("  Acme   Corp ")).toBe("Acme Corp"));
  it("takes 2 to 60 characters", () => {
    expect(cleanCompanyName("A")).toBeNull();
    expect(cleanCompanyName("Ab")).toBe("Ab");
    expect(cleanCompanyName("x".repeat(60))).toHaveLength(60);
    expect(cleanCompanyName("x".repeat(61))).toBeNull();
  });
  it("refuses what is not text", () => {
    expect(cleanCompanyName(null)).toBeNull();
    expect(cleanCompanyName(12)).toBeNull();
  });
});

describe("slugifyCompany", () => {
  const id = "0a1b2c3d-0000-4000-8000-000000000000";
  it("lowercases, joins words and drops accents and edge dashes", () => {
    expect(slugifyCompany("Acme Corp.", id)).toBe("acme-corp");
    expect(slugifyCompany("Café  Nöel!", id)).toBe("cafe-noel");
  });
  it("makes the same slug for names that differ only in case or punctuation", () => {
    expect(slugifyCompany("Acme", id)).toBe(slugifyCompany("acme!", id));
  });
  it("falls back to the request id when nothing is left", () => expect(slugifyCompany("!!", id)).toBe("company-0a1b2c3d"));
  it("stays within 48 characters with no trailing dash", () => {
    const slug = slugifyCompany(`${"a".repeat(47)} b`, id);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});

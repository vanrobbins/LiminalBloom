import { describe, expect, it } from "vitest";

import { personInitial, storeInitials } from "./initials";

describe("storeInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(storeInitials("Pioneer Place")).toBe("PP");
    expect(storeInitials("E2E Second Store")).toBe("ES");
  });

  it("takes two letters of a one-word name", () => {
    expect(storeInitials("Nordstrom")).toBe("NO");
  });

  it("ignores extra spaces and capitalizes", () => {
    expect(storeInitials("  lloyd   center ")).toBe("LC");
  });

  it("keeps a character whole, even outside plain ASCII", () => {
    expect(storeInitials("Émile Zola")).toBe("ÉZ");
    expect(storeInitials("🌸 Bloom")).toBe("🌸B");
  });
});

describe("personInitial", () => {
  it("uses the name's first letter", () => {
    expect(personInitial("van robbins", "van@example.com")).toBe("V");
  });

  it("falls back to the email when the name is blank", () => {
    expect(personInitial("  ", "lee@example.com")).toBe("L");
  });
});

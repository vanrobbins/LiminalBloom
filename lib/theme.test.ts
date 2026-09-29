// The toggle's one rule: whatever is on screen, switch to the other.

import { describe, expect, it } from "vitest";

import { nextTheme } from "./theme";

describe("nextTheme", () => {
  it("switches light to dark", () => {
    expect(nextTheme("light")).toBe("dark");
  });

  it("switches dark to light", () => {
    expect(nextTheme("dark")).toBe("light");
  });

  it("chooses dark before the theme is known", () => {
    // resolvedTheme is undefined until next-themes has read the page.
    expect(nextTheme(undefined)).toBe("dark");
  });

  it("chooses dark for any value it does not recognise", () => {
    // A stale "system" in localStorage must still give a tap something to do.
    expect(nextTheme("system")).toBe("dark");
  });
});

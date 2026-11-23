import { describe, expect, it } from "vitest";

import { confirmPhrase, parseArgs } from "./platform-admin-args";

describe("parseArgs", () => {
  it("reads a grant for development, lowercasing the email", () => {
    expect(parseArgs(["Van@Example.com"])).toEqual({ action: "grant", email: "van@example.com", prod: false });
  });
  it("reads --prod and --reset-two-factor in either order around the email", () => {
    expect(parseArgs(["--prod", "a@b.co"])).toEqual({ action: "grant", email: "a@b.co", prod: true });
    expect(parseArgs(["a@b.co", "--reset-two-factor", "--prod"])).toEqual({ action: "reset-two-factor", email: "a@b.co", prod: true });
  });
  it("refuses no email, two emails, a malformed one and an unknown option", () => {
    expect(parseArgs([])).toHaveProperty("error");
    expect(parseArgs(["a@b.co", "c@d.co"])).toHaveProperty("error");
    expect(parseArgs(["not-an-email"])).toHaveProperty("error");
    expect(parseArgs(["a@b.co", "--force"])).toEqual({ error: "Unknown option --force. Options: --prod, --reset-two-factor." });
  });
});

describe("confirmPhrase", () => {
  it("is a different phrase for each action, so one cannot be typed by habit for the other", () => {
    expect(confirmPhrase("grant")).toBe("grant admin production");
    expect(confirmPhrase("reset-two-factor")).toBe("reset two-factor production");
  });
});

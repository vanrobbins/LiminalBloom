import { describe, expect, it } from "vitest";

import { groupsOfFour, setupKey } from "./totp-key";

describe("setupKey", () => {
  it("reads the secret out of an otpauth link", () => {
    expect(setupKey("otpauth://totp/Liminal%20Bloom:van%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Liminal%20Bloom&digits=6&period=30")).toBe("JBSWY3DPEHPK3PXP");
  });
  it("is null for a link with no secret or a value that is not a link", () => {
    expect(setupKey("otpauth://totp/x?issuer=y")).toBeNull();
    expect(setupKey("not a link")).toBeNull();
  });
});

describe("groupsOfFour", () => {
  it("splits the key for reading aloud, keeping a short last group", () => {
    expect(groupsOfFour("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(groupsOfFour("ABCDEF")).toBe("ABCD EF");
    expect(groupsOfFour("")).toBe("");
  });
});

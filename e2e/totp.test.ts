// e2e/totp.ts against RFC 6238 Appendix B (the three seeds are the ASCII keys "1234567890" repeated to 20, 32 and 64 bytes).

import { describe, expect, it } from "vitest";

import { base32Decode, totp } from "./totp";

const b32 = (ascii: string) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of Buffer.from(ascii)) bits += byte.toString(2).padStart(8, "0");
  return (bits.match(/.{1,5}/g) ?? []).map((chunk) => alphabet[parseInt(chunk.padEnd(5, "0"), 2)]).join("");
};

const SHA1 = b32("12345678901234567890");
const SHA256 = b32("12345678901234567890123456789012");
const SHA512 = b32("1234567890123456789012345678901234567890123456789012345678901234");

// [time in seconds, SHA-1, SHA-256, SHA-512] as RFC 6238 lists them (8 digits).
const VECTORS: [number, string, string, string][] = [
  [59, "94287082", "46119246", "90693936"],
  [1111111109, "07081804", "68084774", "25091201"],
  [1111111111, "14050471", "67062674", "99943326"],
  [1234567890, "89005924", "91819424", "93441116"],
  [2000000000, "69279037", "90698825", "38618901"],
  [20000000000, "65353130", "77737706", "47863826"],
];

describe("totp", () => {
  it.each(VECTORS)("matches RFC 6238 at %i s", (seconds, sha1, sha256, sha512) => {
    const at = seconds * 1000;
    expect(totp(SHA1, { digits: 8, at })).toBe(sha1);
    expect(totp(SHA256, { digits: 8, algorithm: "sha256", at })).toBe(sha256);
    expect(totp(SHA512, { digits: 8, algorithm: "sha512", at })).toBe(sha512);
  });

  it("gives the 6 digits the app uses by default, as the last 6 of the 8", () => {
    expect(totp(SHA1, { at: 59_000 })).toBe("287082");
  });

  it("changes every 30 seconds and not before", () => {
    expect(totp(SHA1, { at: 30_000 })).toBe(totp(SHA1, { at: 59_999 }));
    expect(totp(SHA1, { at: 30_000 })).not.toBe(totp(SHA1, { at: 60_000 }));
  });
});

describe("base32Decode", () => {
  it("decodes RFC 4648 vectors, ignoring spaces, case and padding", () => {
    expect(base32Decode("MZXW6YTBOI======").toString()).toBe("foobar");
    expect(base32Decode("mzxw 6ytb oi").toString()).toBe("foobar");
    expect(base32Decode("").length).toBe(0);
  });

  it("refuses a character outside the alphabet", () => {
    expect(() => base32Decode("MZXW1")).toThrow(/Not base32/);
  });
});

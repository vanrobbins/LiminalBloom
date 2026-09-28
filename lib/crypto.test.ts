// Tests for the encryption primitives behind proposal section 8.1.
//
// These are written before lib/crypto.ts exists. Encryption code is the worst
// place to assume correctness: a broken implementation still produces
// unreadable-looking output, so "it looks encrypted" proves nothing. Each
// property below is one the proposal actually promises.

import { describe, expect, it } from "vitest";

import { decrypt, encrypt, generateKey } from "./crypto";

const STORE_A = "store_aaaaaaaaaaaaaaaaaaaaaa";
const STORE_B = "store_bbbbbbbbbbbbbbbbbbbbbb";

describe("generateKey", () => {
  it("returns 32 bytes, the key length AES-256 requires", () => {
    expect(generateKey()).toHaveLength(32);
  });

  it("returns a different key every time", () => {
    const first = generateKey().toString("hex");
    const second = generateKey().toString("hex");
    expect(first).not.toBe(second);
  });
});

describe("encrypt and decrypt", () => {
  it("returns the original text after a round trip", () => {
    const key = generateKey();
    const sealed = encrypt("sk-live-not-a-real-api-key", key, STORE_A);

    expect(decrypt(sealed, key, STORE_A)).toBe("sk-live-not-a-real-api-key");
  });

  it("does not leave the plaintext readable in the output", () => {
    const key = generateKey();
    const sealed = encrypt("sk-live-not-a-real-api-key", key, STORE_A);

    expect(sealed).not.toContain("sk-live-not-a-real-api-key");
  });

  it("produces different output each time, so repeats are not recognisable", () => {
    const key = generateKey();

    // Encrypting the same value twice must not look identical, or an observer
    // could tell that two stores hold the same secret without decrypting it.
    expect(encrypt("same value", key, STORE_A)).not.toBe(
      encrypt("same value", key, STORE_A),
    );
  });

  it("handles unicode without corrupting it", () => {
    const key = generateKey();
    const sealed = encrypt("café — 24 × 30 ✓", key, STORE_A);

    expect(decrypt(sealed, key, STORE_A)).toBe("café — 24 × 30 ✓");
  });
});

describe("rejecting anything that is not exactly right", () => {
  it("refuses a key that is not the one used to encrypt", () => {
    const sealed = encrypt("secret", generateKey(), STORE_A);

    expect(() => decrypt(sealed, generateKey(), STORE_A)).toThrow();
  });

  it("refuses ciphertext that has been altered", () => {
    // Section 8.1: AES-256-GCM "also detects any tampering with the saved
    // data". Flipping one character must fail loudly, not decrypt to garbage.
    const key = generateKey();
    const sealed = encrypt("secret", key, STORE_A);

    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A");

    expect(() => decrypt(tampered, key, STORE_A)).toThrow();
  });

  it("refuses truncated ciphertext", () => {
    const key = generateKey();
    const sealed = encrypt("secret", key, STORE_A);

    expect(() => decrypt(sealed.slice(0, 10), key, STORE_A)).toThrow();
  });
});

describe("store isolation", () => {
  it("refuses to decrypt one store's value under another store's id", () => {
    // This is the promise in section 8.1: "Every encrypted value records the
    // store it belongs to. If a value is ever copied into another store's
    // records, it fails to decrypt instead of leaking."
    //
    // Even holding the correct key, the wrong store id must fail. This is the
    // acceptance criterion in 1.5: "A user in one store cannot read or
    // decrypt another store's data."
    const key = generateKey();
    const sealed = encrypt("store A's AI key", key, STORE_A);

    expect(() => decrypt(sealed, key, STORE_B)).toThrow();
  });

  it("still decrypts under the store id it was sealed with", () => {
    const key = generateKey();
    const sealed = encrypt("store A's AI key", key, STORE_A);

    expect(decrypt(sealed, key, STORE_A)).toBe("store A's AI key");
  });
});

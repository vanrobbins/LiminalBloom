// Encryption primitives for proposal section 8.1.
//
// AES-256-GCM through Node's built-in crypto. GCM is authenticated
// encryption: it produces a tag alongside the ciphertext, and decryption
// verifies that tag before returning anything. Altered data fails loudly
// rather than decrypting to garbage.
//
// Nothing here knows about stores or the database -- it takes a key and
// returns bytes. lib/store-keys.ts puts it to work.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // 256 bits
const IV_BYTES = 12; // 96 bits, the size GCM is designed around
const TAG_BYTES = 16;

/** A fresh 256-bit key. Used for both store keys and, once, the master key. */
export function generateKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

/**
 * Seal `plaintext` with `key`, bound to `context`.
 *
 * `context` is additional authenticated data: it is not stored in the output
 * and is not secret, but decryption only succeeds when the same value is
 * supplied again. Passing the store id means a value copied into another
 * store's records cannot be read there, even with the right key -- the
 * guarantee section 8.1 makes. It is enforced by the cipher, not by a check
 * someone could forget to write.
 *
 * Returns base64 of: iv | tag | ciphertext.
 */
export function encrypt(
  plaintext: string,
  key: Buffer,
  context: string,
): string {
  // A fresh iv per call is what makes two encryptions of the same value look
  // different. Reusing one with the same key breaks GCM badly.
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  );
}

/**
 * Open a value produced by `encrypt`.
 *
 * Throws if the key is wrong, the context is wrong, or the data has been
 * altered or truncated. Callers should let it throw: a failure here means
 * something is wrong with the data, and returning a fallback would hide it.
 */
export function decrypt(sealed: string, key: Buffer, context: string): string {
  const raw = Buffer.from(sealed, "base64");

  if (raw.length < IV_BYTES + TAG_BYTES) {
    throw new Error("Encrypted value is too short to be valid.");
  }

  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);

  // final() is where the tag is checked, so it throws on any mismatch.
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

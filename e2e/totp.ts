// RFC 6238 time-based one-time passwords on node:crypto, so the e2e specs can answer the app's two-step
// sign-in without a package. The app's authenticator codes are the RFC's defaults (SHA-1, 6 digits, 30 s),
// and the setup screen shows the key in base32, which is what `totp` takes. The unit test is e2e/totp.test.ts.

import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 to bytes; spaces, case and padding are ignored (the setup screen shows the key in groups of four). */
export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of text.toUpperCase().replace(/[\s=]/g, "")) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error(`Not base32: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

type Options = { digits?: number; period?: number; algorithm?: "sha1" | "sha256" | "sha512"; at?: number };

/** The code for the base32 `secret` at `at` (milliseconds, default now): HMAC of the 30-second counter, dynamic truncation. */
export function totp(secret: string, { digits = 6, period = 30, algorithm = "sha1", at = Date.now() }: Options = {}): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / period)));
  const hmac = createHmac(algorithm, base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Six digits that are not the code now or in the windows either side of it, which the server also accepts. */
export function wrongCode(secret: string, digits = 6): string {
  const near = [-60, -30, 0, 30, 60].map((seconds) => totp(secret, { digits, at: Date.now() + seconds * 1000 }));
  for (let n = 111111; ; n++) if (!near.includes(String(n).padStart(digits, "0"))) return String(n).padStart(digits, "0");
}

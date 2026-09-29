// Generates one 32-byte key, base64 encoded, for MASTER_KEY or
// BETTER_AUTH_SECRET. Run with: npm run key:generate
//
// randomBytes is cryptographically secure. Math.random() is NOT, and must
// never be used for anything that protects data.

import { randomBytes } from "node:crypto";

console.log(randomBytes(32).toString("base64"));

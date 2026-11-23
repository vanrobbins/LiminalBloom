// Setup for database tests of passkeys: a passkey row for an account without a real authenticator
// (the rows are Better Auth's own `passkey` table; they go with the account). Test code only.

import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { passkey } from "@/db/auth-schema";

export async function addPasskeyRow(userId: string, name: string | null = "Test key", createdAt: Date = new Date()) {
  const row = { id: randomUUID(), userId, name, credentialID: randomUUID(), publicKey: "AAAA", counter: 0, deviceType: "multiDevice", backedUp: true, createdAt };
  await db.insert(passkey).values(row);
  return row;
}

// Per-store encryption keys: proposal section 8.1.
//
// Three layers:
//   1. MASTER KEY  one per app, in the server environment, never in the database
//   2. STORE KEY   one per store, saved only after being wrapped by the master key
//   3. STORE DATA  AI keys, invite tokens, staff contact details
//
// Reading a store's secrets needs both the master key and that store's row.
// The database on its own is useless, and one store's key opens nothing in
// any other store.
//
// Server only. A store key is unlocked for the length of one call and is
// never cached in a module variable, written to a log, or returned by an API.

import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { keyEvents, storeKeys } from "@/db/schema";

import { decrypt, encrypt, generateKey } from "./crypto";
import { requiredEnv } from "./env";

/**
 * The master key, read fresh from the environment on each use.
 *
 * Deliberately not a module-level constant: that would run at import time and
 * crash anything that touches this file in an environment without the key,
 * with an error far from the real cause.
 */
function masterKey(): Buffer {
  const key = Buffer.from(requiredEnv("MASTER_KEY"), "base64");

  if (key.length !== 32) {
    throw new Error(
      `MASTER_KEY must be 32 bytes, base64 encoded; got ${key.length}.`,
    );
  }

  return key;
}

/**
 * Give a store its own key. Called once, when the store is created.
 *
 * The key is generated, immediately wrapped with the master key, and only the
 * wrapped form is stored. The raw key is not returned -- callers that need it
 * go through `getStoreKey`, so there is one path and one place to audit.
 */
export async function createStoreKey(storeId: string): Promise<void> {
  const key = generateKey();

  // The store id is bound into the wrapping, so a row copied into another
  // store's records cannot be unwrapped there.
  const wrappedKey = encrypt(key.toString("base64"), masterKey(), storeId);

  await db.insert(storeKeys).values({ storeId, wrappedKey, version: 1 });

  await db.insert(keyEvents).values({
    storeId,
    event: "created",
    keyVersion: 1,
  });
}

/**
 * Give a newly created store its key, or remove the store.
 *
 * Better Auth creates the store and its owner's membership before this runs,
 * with no transaction around them. If the key cannot be made -- a missing or
 * wrong MASTER_KEY, a database error -- the store would otherwise live on
 * without one. Removing it (its memberships and any partial key row cascade)
 * keeps the rule that no store ever exists without a key. The error is
 * rethrown so the request that created the store fails visibly.
 */
export async function giveStoreItsKey(storeId: string): Promise<void> {
  try {
    await createStoreKey(storeId);
  } catch (error) {
    await db.delete(organization).where(eq(organization.id, storeId));
    throw error;
  }
}

/**
 * Unlock a store's active key for the length of one request.
 *
 * Throws when the store has no active key: callers should not proceed with a
 * fallback, because there is no safe way to handle a store whose key is
 * missing.
 */
export async function getStoreKey(storeId: string): Promise<Buffer> {
  const [row] = await db
    .select()
    .from(storeKeys)
    .where(and(eq(storeKeys.storeId, storeId), eq(storeKeys.status, "active")));

  if (!row) {
    throw new Error(`Store ${storeId} has no active encryption key.`);
  }

  return Buffer.from(decrypt(row.wrappedKey, masterKey(), storeId), "base64");
}

/** Seal a value so that only this store can read it. */
export async function encryptForStore(
  storeId: string,
  plaintext: string,
): Promise<string> {
  return encrypt(plaintext, await getStoreKey(storeId), storeId);
}

/**
 * Open a value sealed for this store.
 *
 * Throws if the value belongs to a different store, even when that store's
 * key is available -- the store id is bound into the ciphertext itself.
 */
export async function decryptForStore(
  storeId: string,
  sealed: string,
): Promise<string> {
  return decrypt(sealed, await getStoreKey(storeId), storeId);
}

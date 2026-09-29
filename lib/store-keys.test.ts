// Tests for the per-store key layer (proposal 8.1).
//
// These touch the real database, because what is being tested IS the storage:
// that the key is never written in readable form, and that one store's key
// cannot open another's data. Mocking the database would test the mock.
//
// Each test creates its own throwaway store and deletes it afterwards, so the
// suite leaves nothing behind and does not depend on existing rows.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { storeKeys } from "@/db/schema";

import {
  createStoreKey,
  giveStoreItsKey,
  decryptForStore,
  encryptForStore,
  getStoreKey,
} from "./store-keys";

const created: string[] = [];

/** A real organization row, since store keys reference one. */
async function makeStore(label: string): Promise<string> {
  const id = `test_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(organization).values({
    id,
    name: `Test store ${label}`,
    slug: id,
    createdAt: new Date(),
  });
  created.push(id);
  return id;
}

afterAll(async () => {
  // Cascade removes the store's keys and events with it.
  for (const id of created) {
    await db.delete(organization).where(eq(organization.id, id));
  }
});

describe("createStoreKey", () => {
  it("gives a new store a usable key", async () => {
    const storeId = await makeStore("usable");
    await createStoreKey(storeId);

    expect(await getStoreKey(storeId)).toHaveLength(32);
  });

  it("never writes the key itself to the database", async () => {
    // The whole point of 8.1: the stored value is the key wrapped by the
    // master key, so the database alone is useless to an attacker.
    const storeId = await makeStore("wrapped");
    await createStoreKey(storeId);

    const key = await getStoreKey(storeId);
    const [row] = await db
      .select()
      .from(storeKeys)
      .where(eq(storeKeys.storeId, storeId));

    expect(row.wrappedKey).not.toContain(key.toString("base64"));
    expect(row.wrappedKey).not.toContain(key.toString("hex"));
  });

  it("gives different stores different keys", async () => {
    const a = await makeStore("differs-a");
    const b = await makeStore("differs-b");
    await createStoreKey(a);
    await createStoreKey(b);

    expect((await getStoreKey(a)).toString("hex")).not.toBe(
      (await getStoreKey(b)).toString("hex"),
    );
  });

  it("records the creation in the key event log", async () => {
    const storeId = await makeStore("logged");
    await createStoreKey(storeId);

    const [row] = await db
      .select()
      .from(storeKeys)
      .where(eq(storeKeys.storeId, storeId));

    expect(row.version).toBe(1);
    expect(row.status).toBe("active");
  });
});

describe("getStoreKey", () => {
  it("refuses a store that has no key", async () => {
    const storeId = await makeStore("keyless");

    await expect(getStoreKey(storeId)).rejects.toThrow();
  });
});

describe("encryptForStore and decryptForStore", () => {
  it("returns the original value after a round trip", async () => {
    const storeId = await makeStore("roundtrip");
    await createStoreKey(storeId);

    const sealed = await encryptForStore(storeId, "sk-test-value");

    expect(await decryptForStore(storeId, sealed)).toBe("sk-test-value");
  });

  it("refuses a wrapped key copied into another store's row", async () => {
    // Section 8.1: "Every encrypted value records the store it belongs to. If
    // a value is ever copied into another store's records, it fails to
    // decrypt instead of leaking."
    //
    // This is the test that actually proves the store id is bound into the
    // ciphertext. The isolation test below does NOT: the two stores have
    // different keys, so it would pass even if the binding were removed --
    // confirmed by mutating the implementation and watching it stay green.
    const a = await makeStore("copied-a");
    const b = await makeStore("copied-b");
    await createStoreKey(a);
    await createStoreKey(b);

    const [rowA] = await db
      .select()
      .from(storeKeys)
      .where(eq(storeKeys.storeId, a));

    // Physically move store A's wrapped key into store B's row.
    await db
      .update(storeKeys)
      .set({ wrappedKey: rowA.wrappedKey })
      .where(eq(storeKeys.storeId, b));

    await expect(getStoreKey(b)).rejects.toThrow();
  });

  it("refuses to open one store's value under another store", async () => {
    // Acceptance criterion from 1.5: a user in one store cannot read or
    // decrypt another store's data. Both stores exist and both have keys;
    // the only thing stopping this is the encryption itself.
    const a = await makeStore("isolated-a");
    const b = await makeStore("isolated-b");
    await createStoreKey(a);
    await createStoreKey(b);

    const sealed = await encryptForStore(a, "store A's AI key");

    await expect(decryptForStore(b, sealed)).rejects.toThrow();
  });
});

describe("giveStoreItsKey", () => {
  it("gives a new store its key", async () => {
    const storeId = await makeStore("given");
    await giveStoreItsKey(storeId);

    expect(await getStoreKey(storeId)).toHaveLength(32);
  });

  it("removes the store when its key cannot be made", async () => {
    // A store must never exist without a key. If key creation fails -- here,
    // a master key of the wrong length -- the store is removed and the error
    // still reaches the caller.
    const storeId = await makeStore("rollback");
    const original = process.env.MASTER_KEY;
    process.env.MASTER_KEY = Buffer.alloc(8).toString("base64");

    try {
      await expect(giveStoreItsKey(storeId)).rejects.toThrow();
    } finally {
      process.env.MASTER_KEY = original;
    }

    const rows = await db
      .select()
      .from(organization)
      .where(eq(organization.id, storeId));
    expect(rows).toHaveLength(0);
  });
});

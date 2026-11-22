// Tests for choosing which store a session opens in.
//
// These touch the real database, because the rule is about real rows: who
// belongs where, since when, and what they used last. Each test creates its
// own people and stores and deletes them afterwards; deleting a user or a
// store cascades to its memberships.

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, organization, user } from "@/db/auth-schema";

import { chooseActiveStore, rememberActiveStore } from "./active-store";

const users: string[] = [];
const stores: string[] = [];

function uniqueId(label: string): string {
  return `test_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function makeUser(label: string): Promise<string> {
  const id = uniqueId(label);
  await db
    .insert(user)
    .values({ id, name: `Test ${label}`, email: `${id}@example.com` });
  users.push(id);
  return id;
}

async function makeStore(label: string): Promise<string> {
  const id = uniqueId(label);
  await db.insert(organization).values({
    id,
    name: `Test store ${label}`,
    slug: id,
    createdAt: new Date(),
  });
  stores.push(id);
  return id;
}

/** Membership with an explicit join time, so "joined first" is deterministic. */
async function join(
  userId: string,
  storeId: string,
  joinedAt: Date,
): Promise<void> {
  await db.insert(member).values({
    id: uniqueId("member"),
    userId,
    organizationId: storeId,
    role: "owner",
    createdAt: joinedAt,
  });
}

const EARLIER = new Date("2026-01-01T00:00:00Z");
const LATER = new Date("2026-06-01T00:00:00Z");

afterAll(async () => {
  if (users.length) await db.delete(user).where(inArray(user.id, users));
  if (stores.length) {
    await db.delete(organization).where(inArray(organization.id, stores));
  }
});

describe("chooseActiveStore", () => {
  it("returns null for someone in no store", async () => {
    const person = await makeUser("none");
    expect(await chooseActiveStore(person)).toBeNull();
  });

  it("returns the only store someone belongs to", async () => {
    const person = await makeUser("one");
    const store = await makeStore("one");
    await join(person, store, EARLIER);

    expect(await chooseActiveStore(person)).toBe(store);
  });

  it("returns the store joined first when none has been used yet", async () => {
    const person = await makeUser("two");
    const first = await makeStore("first");
    const second = await makeStore("second");
    await join(person, second, LATER);
    await join(person, first, EARLIER);

    expect(await chooseActiveStore(person)).toBe(first);
  });

  it("returns the store used last", async () => {
    const person = await makeUser("last");
    const first = await makeStore("first");
    const second = await makeStore("second");
    await join(person, first, EARLIER);
    await join(person, second, LATER);
    await db
      .update(user)
      .set({ lastActiveStoreId: second })
      .where(eq(user.id, person));

    expect(await chooseActiveStore(person)).toBe(second);
  });

  it("ignores the last store once the person has left it", async () => {
    const person = await makeUser("left");
    const first = await makeStore("first");
    const second = await makeStore("second");
    await join(person, first, EARLIER);
    await join(person, second, LATER);
    await db
      .update(user)
      .set({ lastActiveStoreId: second })
      .where(eq(user.id, person));
    await db.delete(member).where(eq(member.organizationId, second));

    expect(await chooseActiveStore(person)).toBe(first);
  });

  it("ignores the last store once it has been deleted", async () => {
    const person = await makeUser("deleted");
    const gone = await makeStore("gone");
    await join(person, gone, EARLIER);
    await db
      .update(user)
      .set({ lastActiveStoreId: gone })
      .where(eq(user.id, person));
    await db.delete(organization).where(eq(organization.id, gone));

    expect(await chooseActiveStore(person)).toBeNull();
  });
});

describe("rememberActiveStore", () => {
  it("makes the remembered store the one chosen next time", async () => {
    const person = await makeUser("remember");
    const first = await makeStore("first");
    const second = await makeStore("second");
    await join(person, first, EARLIER);
    await join(person, second, LATER);

    await rememberActiveStore(person, second);

    expect(await chooseActiveStore(person)).toBe(second);
  });
});

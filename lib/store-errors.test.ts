// Tests for telling a taken store slug apart from every other failure.
//
// Uses the real error Better Auth throws, by asking it to create a store
// whose slug already exists, so a change in Better Auth's error shape fails
// here rather than silently turning every error into a retry.

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organization, user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

import { isSlugTaken } from "./store-errors";

const users: string[] = [];
const stores: string[] = [];

function uniqueId(label: string): string {
  return `test_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

afterAll(async () => {
  if (users.length) await db.delete(user).where(inArray(user.id, users));
  if (stores.length) {
    await db.delete(organization).where(inArray(organization.id, stores));
  }
});

describe("isSlugTaken", () => {
  it("recognises Better Auth's error for a slug already in use", async () => {
    const userId = uniqueId("slug-user");
    await db
      .insert(user)
      .values({ id: userId, name: "Slug test", email: `${userId}@example.com` });
    users.push(userId);

    const slug = uniqueId("slug");
    await db
      .insert(organization)
      .values({ id: slug, name: "Taken", slug, createdAt: new Date() });
    stores.push(slug);

    const error = await auth.api
      .createOrganization({ body: { name: "Taken again", slug, userId } })
      .then(() => null, (thrown: unknown) => thrown);

    expect(isSlugTaken(error)).toBe(true);
  });

  it("does not treat other failures as a taken slug", () => {
    expect(isSlugTaken(new Error("MASTER_KEY must be 32 bytes"))).toBe(false);
    expect(isSlugTaken(null)).toBe(false);
    expect(isSlugTaken({ body: { code: "FORBIDDEN" } })).toBe(false);
  });
});

// Keep the store id list honest if Better Auth ever creates the store anyway.
afterAll(async () => {
  await db.delete(organization).where(eq(organization.name, "Taken again"));
});

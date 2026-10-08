// Which database and Blob store the seed writes to, and the demo store in it
// (spec §6.1–6.2). Production is chosen only by `--prod`, and only by swapping
// in the PRODUCTION_ values before anything connects.

import { and, eq, sql } from "drizzle-orm";

import { requiredEnv } from "@/lib/env";

export const DEMO_EMAIL = "demo@liminalbloom.app";
export const DEMO_STORE = "Liminal Bloom Demo";
const DEMO_SLUG = "liminal-bloom-demo";

/** Must run before @/db is imported: the connection is made at import time. */
export function switchToProduction(): void {
  process.env.DATABASE_URL = requiredEnv("PRODUCTION_DATABASE_URL");
  delete process.env.DATABASE_URL_POOLED;
  process.env.BLOB_READ_WRITE_TOKEN = requiredEnv("PRODUCTION_BLOB_READ_WRITE_TOKEN");
}

export async function findDemoStore(): Promise<{ storeId: string; productCount: number } | null> {
  const { db } = await import("@/db");
  const { member, organization, user } = await import("@/db/auth-schema");
  const { products } = await import("@/db/schema");
  const rows = await db
    .select({ storeId: organization.id })
    .from(organization)
    .innerJoin(member, eq(member.organizationId, organization.id))
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(organization.name, DEMO_STORE), eq(user.email, DEMO_EMAIL), eq(member.role, "owner")));
  const storeId = rows[0]?.storeId;
  if (!storeId) return null;
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.storeId, storeId));
  return { storeId, productCount: count.n };
}

/** Dev only: production's account and store are made on the live site (spec §6.2). */
export async function createDemoStore(): Promise<string> {
  const { auth } = await import("@/lib/auth");
  const { db } = await import("@/db");
  const { user } = await import("@/db/auth-schema");
  let [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, DEMO_EMAIL));
  if (!existing) {
    const created = await auth.api.signUpEmail({ body: { email: DEMO_EMAIL, password: requiredEnv("DEMO_PASSWORD"), name: "Demo VM Lead" } });
    existing = { id: created.user.id };
  }
  // The organization hook gives the store its encryption key, as for any new store.
  const store = await auth.api.createOrganization({ body: { name: DEMO_STORE, slug: DEMO_SLUG, userId: existing.id } });
  if (!store) throw new Error("Better Auth did not create the demo store.");
  return store.id;
}

// Adding a store to a company (spec 0.7.1 6.4, B0 finding 1). Better Auth makes the store; its creation hook gives
// it the key, settings and five roles, and Better Auth always adds the creator as a `member` (Store Manager)
// before the hook runs, with no way to stop the row. A company person reaches the store through the company, so
// the row would only make them its untouchable Store Manager: ONE owner-connection batch inserts the profile,
// sets the time zone directly (setStoreTimezone asks resolveAccess, and the creator has no grant until the
// profile exists), deletes the creator's row and logs the event. If the batch fails the store is removed, so no
// store, member, role, key or settings row is left.

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { companyEvents, regions, storeProfiles, storeSettings } from "@/db/schema";
import { isSlugTaken } from "@/lib/store-errors";
import { cleanStoreName } from "@/lib/store-name-limits";
import { removeStore } from "@/lib/store-keys";
import { slugify } from "@/lib/store-slug";
import { canonicalZone } from "@/lib/time/zones";

import type { CompanyActor } from "./events";

export type AddStoreInput = { name: string; timezone: string; regionId: string | null };
export type AddStoreActor = CompanyActor & { companyId: string };
/** Makes the Better Auth organization (the action passes the request's headers; a test passes a user id). */
export type CreateStore = (name: string, slug: string) => Promise<{ id: string } | null>;

export type AddStoreOutcome = { status: "added"; storeId: string } | { status: "invalid-name" | "invalid-zone" | "invalid-region" | "failed" };

export async function addCompanyStore(input: AddStoreInput, actor: AddStoreActor, create: CreateStore): Promise<AddStoreOutcome> {
  const name = cleanStoreName(input.name);
  if (name === null || slugify(name) === "") return { status: "invalid-name" };
  const timezone = canonicalZone(input.timezone);
  if (timezone === null) return { status: "invalid-zone" };
  let regionName: string | null = null;
  if (input.regionId !== null) {
    const [region] = await db.select({ name: regions.name }).from(regions).where(and(eq(regions.id, input.regionId), eq(regions.companyId, actor.companyId)));
    if (!region) return { status: "invalid-region" };
    regionName = region.name;
  }

  // Slugs are unique across every store: the clean one, then a suffixed one.
  const base = slugify(name);
  let created: { id: string } | null = null;
  for (const slug of [base, `${base}-${Math.random().toString(36).slice(2, 7)}`]) {
    try {
      created = await create(name, slug);
      break;
    } catch (error) {
      // Not a slug clash: the creation hook removes the store itself when its key, settings or roles fail (lib/auth.ts),
      // and a failure before the organization row exists leaves nothing. The one gap is Better Auth failing to add the
      // creator after inserting the row: an inert organization (no member, no profile, no data) whose id we are never
      // given. Removing it by slug could take another store made at the same moment, so it is left.
      if (!isSlugTaken(error)) return { status: "failed" };
    }
  }
  if (!created) return { status: "failed" };

  const storeId = created.id;
  try {
    await db.batch([
      db.insert(storeProfiles).values({ storeId, companyId: actor.companyId, regionId: input.regionId }),
      db.update(storeSettings).set({ timezone, version: sql`${storeSettings.version} + 1`, updatedAt: new Date() }).where(eq(storeSettings.storeId, storeId)),
      db.delete(member).where(and(eq(member.organizationId, storeId), eq(member.userId, actor.userId))),
      db.insert(companyEvents).values({ companyId: actor.companyId, actorId: actor.userId, actorName: actor.name, event: "store_added", detail: { store: name, region: regionName } }),
    ]);
  } catch (error) {
    console.error("add-company-store: store not completed, removing it", storeId, error);
    // The store then has a member row for a few milliseconds; harmless (they are a Store Manager there).
    await removeStore(storeId).catch((cleanup: unknown) => console.error("add-company-store: store not removed", storeId, cleanup));
    return { status: "failed" };
  }
  return { status: "added", storeId };
}

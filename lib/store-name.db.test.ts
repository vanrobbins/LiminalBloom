// Renaming a store against the development database: the name and its access_events row
// are written together, a stale pin changes nothing, and a refusal writes nothing.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { eventsOf } from "@/lib/access/people-test";
import { dropPeople, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { renameStore } from "./store-name";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const nameOf = async (store: string) => (await db.select({ n: organization.name }).from(organization).where(eq(organization.id, store)))[0].n;

async function setup(label: string) {
  const s = await makeStoreWithRoles(label);
  const { userId } = await makePerson(s.store, s.roles.store_manager);
  return { store: s.store, actor: { userId, name: "Sue Manager" }, seen: await nameOf(s.store) };
}

describe("renameStore", () => {
  it("renames and logs store_renamed with the old and new name", async () => {
    const { store, actor, seen } = await setup("rename-ok");
    expect(await renameStore(store, actor, seen, "  Riverside  ")).toEqual({ status: "renamed" });
    expect(await nameOf(store)).toBe("Riverside");
    const events = await eventsOf(store);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: "store_renamed", actorId: actor.userId, actorName: "Sue Manager", detail: { from: seen, to: "Riverside" } });
  });

  it("is stale, and writes nothing, when the name moved since the person saw it", async () => {
    const { store, actor, seen } = await setup("rename-stale");
    expect(await renameStore(store, actor, seen, "First")).toEqual({ status: "renamed" });
    expect(await renameStore(store, actor, seen, "Second")).toEqual({ status: "stale" });
    expect(await nameOf(store)).toBe("First");
    expect(await eventsOf(store)).toHaveLength(1);
  });

  it("refuses a bad name and an unchanged one without writing", async () => {
    const { store, actor, seen } = await setup("rename-refuse");
    expect(await renameStore(store, actor, seen, "x")).toEqual({ status: "invalid" });
    expect(await renameStore(store, actor, seen, "y".repeat(61))).toEqual({ status: "invalid" });
    expect(await renameStore(store, actor, seen, `  ${seen} `)).toEqual({ status: "unchanged" });
    expect(await nameOf(store)).toBe(seen);
    expect(await eventsOf(store)).toHaveLength(0);
  });

  it("renames only the store it is given", async () => {
    const a = await setup("rename-a");
    const b = await setup("rename-b");
    await renameStore(a.store, a.actor, a.seen, "Only A");
    expect(await nameOf(b.store)).toBe(b.seen);
  });

  it("two renames made together: exactly one wins", async () => {
    const { store, actor, seen } = await setup("rename-race");
    const results = await Promise.all([renameStore(store, actor, seen, "Left"), renameStore(store, actor, seen, "Right")]);
    expect(results.map((r) => r.status).sort()).toEqual(["renamed", "stale"]);
    expect(await eventsOf(store)).toHaveLength(1);
  });
});

// Cancel an invitation against the dev database: the rank rule of the role it names,
// and gone for one already used, missing or another store's.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation } from "@/db/auth-schema";
import { dropStores } from "@/lib/products/test-stores";

import { cancelInvitation } from "./people-write";
import { actorIn, eventsOf } from "./people-test";
import { dropPeople, makeInvitation, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

describe("cancelInvitation", () => {
  const statusOf = async (id: string) => (await db.select({ s: invitation.status }).from(invitation).where(eq(invitation.id, id)))[0].s;

  it("cancels a pending invitation below the actor's rank and writes the event", async () => {
    const s = await makeStoreWithRoles("pw-cancel");
    const actor = await actorIn(s, "vm_manager");
    const id = await makeInvitation(s.store, actor.userId, s.roles.sales_associate);
    const out = await cancelInvitation(s.store, actor, id);
    expect(out.status).toBe("cancelled");
    expect(await statusOf(id)).toBe("canceled");
    const events = await eventsOf(s.store);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: actor.userId, event: "invitation_cancelled" });
    expect(events[0].detail).toMatchObject({ role: "Sales Associate" });
    expect(await cancelInvitation(s.store, actor, id)).toEqual({ status: "gone" });
    expect(await eventsOf(s.store)).toHaveLength(1);
  });

  it("refuses an invitation into a role at or above the actor's, and an actor without people.manage", async () => {
    const s = await makeStoreWithRoles("pw-cancel-rank");
    const actor = await actorIn(s, "assistant_manager");
    const manager = await actorIn(s, "store_manager");
    const same = await makeInvitation(s.store, manager.userId, s.roles.assistant_manager);
    const above = await makeInvitation(s.store, manager.userId, s.roles.store_manager);
    expect(await cancelInvitation(s.store, actor, same)).toEqual({ status: "forbidden" });
    expect(await cancelInvitation(s.store, actor, above)).toEqual({ status: "forbidden" });
    const worker = await actorIn(s, "vm_worker");
    const low = await makeInvitation(s.store, manager.userId, s.roles.sales_associate);
    expect(await cancelInvitation(s.store, worker, low)).toEqual({ status: "forbidden" });
    expect(await statusOf(same)).toBe("pending");
    expect(await statusOf(low)).toBe("pending");
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("says gone for an accepted invitation, a missing one and another store's", async () => {
    const s = await makeStoreWithRoles("pw-cancel-gone");
    const other = await makeStoreWithRoles("pw-cancel-gone-other");
    const actor = await actorIn(s, "store_manager");
    const used = await makeInvitation(s.store, actor.userId, s.roles.sales_associate);
    await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, used));
    expect(await cancelInvitation(s.store, actor, used)).toEqual({ status: "gone" });
    expect(await cancelInvitation(s.store, actor, "no-such-invitation")).toEqual({ status: "gone" });
    const foreign = await makeInvitation(other.store, (await actorIn(other, "store_manager")).userId, other.roles.sales_associate);
    expect(await cancelInvitation(s.store, actor, foreign)).toEqual({ status: "gone" });
    expect(await statusOf(foreign)).toBe("pending");
  });

  it("lets a manager cancel an invitation that names no role (it ranks below every role)", async () => {
    const s = await makeStoreWithRoles("pw-cancel-norole");
    const actor = await actorIn(s, "vm_manager");
    const id = await makeInvitation(s.store, actor.userId, null);
    expect((await cancelInvitation(s.store, actor, id)).status).toBe("cancelled");
  });
});

// The real switchStore with the real current-member, resolveAccess and setActiveStore against the dev
// database: only Better Auth's session is stood in for. A switch writes the session's store and the person's
// remembered store together, and only for a store the person reaches.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { storeSuspensions } from "@/db/schema";
import { dropPeople, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { makeSession, sessionStore } from "@/lib/access/test-session";
import { dropStores } from "@/lib/products/test-stores";

import { switchStore } from "./switch-store-actions";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

/** A real session row and the mocked Better Auth answer for it. */
async function signIn(userId: string, active: string | null) {
  const id = await makeSession(userId, active);
  mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Van", email: `${userId}@example.com` }, session: { id, activeStoreId: active, activeOrganizationId: null } });
  return id;
}

const stored = sessionStore;
const remembered = async (userId: string) => (await db.select({ last: user.lastActiveStoreId }).from(user).where(eq(user.id, userId)))[0].last;

describe("switchStore", () => {
  let a: Awaited<ReturnType<typeof makeStoreWithRoles>>;
  let b: Awaited<ReturnType<typeof makeStoreWithRoles>>;
  let userId: string;

  beforeEach(async () => {
    a = await makeStoreWithRoles("switch-a");
    b = await makeStoreWithRoles("switch-b");
    ({ userId } = await makePerson(a.store, a.roles.sales_associate));
    await db.insert(member).values({ id: crypto.randomUUID(), organizationId: b.store, userId, role: "member", roleId: b.roles.vm_worker, createdAt: new Date(Date.now() + 1000) });
  });

  it("writes the session's store and the person's remembered store together", async () => {
    const id = await signIn(userId, a.store);
    expect(await switchStore(b.store)).toEqual({ status: "switched" });
    expect(await stored(id)).toBe(b.store);
    expect(await remembered(userId)).toBe(b.store);
  });

  it("refuses a store the person does not belong to and writes nothing", async () => {
    const other = await makeStoreWithRoles("switch-other");
    const id = await signIn(userId, a.store);
    expect(await switchStore(other.store)).toEqual({ status: "forbidden" });
    expect(await stored(id)).toBe(a.store);
    expect(await remembered(userId)).toBeNull();
  });

  it("refuses a paused store, a store that does not exist, and values that are not a store id", async () => {
    const id = await signIn(userId, a.store);
    await db.insert(storeSuspensions).values({ storeId: b.store, reason: "db test", suspendedByName: "Test" });
    expect(await switchStore(b.store)).toEqual({ status: "forbidden" });
    for (const bad of ["no-such-store", "", null, undefined, 42, { id: b.store }, "x".repeat(300)]) expect(await switchStore(bad), String(bad)).toEqual({ status: "forbidden" });
    expect(await stored(id)).toBe(a.store);
  });

  it("changes only this person's session: another person's session with the same id is not touched", async () => {
    const id = await signIn(userId, a.store);
    const stranger = await makePerson(b.store, b.roles.vm_worker);
    mocks.getSession.mockResolvedValue({ user: { id: stranger.userId, name: "S", email: "s@example.com" }, session: { id, activeStoreId: b.store, activeOrganizationId: null } });
    expect(await switchStore(b.store)).toEqual({ status: "switched" });
    expect(await stored(id)).toBe(a.store);
  });

  it("sends a signed-out visitor to sign in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(switchStore(a.store)).rejects.toThrow("redirect:/sign-in");
  });
});

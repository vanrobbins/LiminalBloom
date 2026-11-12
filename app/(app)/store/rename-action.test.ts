// The real renameStoreAction with the real current-member and resolveAccess against the dev
// database: only Better Auth's session is stood in for, so who may rename is decided by a
// real role's switches.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, listOrganizations: mocks.listOrganizations } } }));

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { dropPeople, makePerson, makeStoreWithRoles, type StoreRoles } from "@/lib/access/test-roles";
import { eventsOf } from "@/lib/access/people-test";
import { dropStores } from "@/lib/products/test-stores";

import { renameStoreAction } from "./actions";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const NOT_ALLOWED = { status: "refused", message: "Your role can't change store settings." };
const NAME_LENGTH = { status: "refused", message: "Give the store a name of 2 to 60 characters." };
const nameOf = async (store: string) => (await db.select({ n: organization.name }).from(organization).where(eq(organization.id, store)))[0].n;

describe("renameStoreAction", () => {
  let store: string;
  let roles: StoreRoles;
  let seen: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ store, roles } = await makeStoreWithRoles("rename-action"));
    seen = await nameOf(store);
  });

  async function signInAs(role: keyof StoreRoles | null) {
    const { userId } = await makePerson(store, role ? roles[role] : null);
    mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Van", email: `${userId}@example.com` }, session: { activeOrganizationId: store } });
    mocks.listOrganizations.mockResolvedValue([{ id: store, name: seen }]);
    return userId;
  }

  it("renames for a Store Manager, logs the event and refreshes the layout", async () => {
    const userId = await signInAs("store_manager");
    expect(await renameStoreAction("  Riverside ", seen)).toEqual({ status: "saved", message: "Store name saved" });
    expect(await nameOf(store)).toBe("Riverside");
    expect((await eventsOf(store)).map((e) => [e.event, e.actorId, e.actorName, e.detail])).toEqual([["store_renamed", userId, "Van", { from: seen, to: "Riverside" }]]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it.each(["assistant_manager", "vm_manager", "vm_worker", "sales_associate", null] as const)("refuses a member whose role is %s, in words, and changes nothing", async (role) => {
    await signInAs(role);
    expect(await renameStoreAction("Riverside", seen)).toEqual(NOT_ALLOWED);
    expect(await nameOf(store)).toBe(seen);
    expect(await eventsOf(store)).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a name that is blank, one character, over 60, or not text, in words", async () => {
    await signInAs("store_manager");
    for (const bad of ["", "   ", "A", "x".repeat(61), 42, null]) expect(await renameStoreAction(bad, seen)).toEqual(NAME_LENGTH);
    expect(await renameStoreAction("Riverside", 7)).toEqual(NAME_LENGTH);
    expect(await nameOf(store)).toBe(seen);
    expect(await eventsOf(store)).toHaveLength(0);
  });

  it("says the name changed on another device when the page was out of date, and keeps the other name", async () => {
    await signInAs("store_manager");
    expect(await renameStoreAction("First", seen)).toEqual({ status: "saved", message: "Store name saved" });
    expect(await renameStoreAction("Second", seen)).toEqual({ status: "refused", message: "Changed on another device" });
    expect(await nameOf(store)).toBe("First");
  });

  it("saving the same name again is a quiet success that writes nothing", async () => {
    await signInAs("store_manager");
    expect(await renameStoreAction(` ${seen} `, seen)).toEqual({ status: "saved", message: "Store name saved" });
    expect(await eventsOf(store)).toHaveLength(0);
  });

  it("sends a signed-out visitor to sign in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(renameStoreAction("Riverside", seen)).rejects.toThrow("redirect:/sign-in");
  });
});

// The real saveTimezoneAction with the real current-member and resolveAccess
// against the dev database: only Better Auth's session is stood in for, so who
// may save is decided by a real role's switches.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, listOrganizations: mocks.listOrganizations } } }));

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { dropPeople, makePerson, makeStoreWithRoles, type StoreRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";
import { storeSettingsFor } from "@/lib/store-settings";

import { saveTimezoneAction } from "./actions";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const NOT_ALLOWED = { status: "refused", message: "Your role can't change store settings." };

describe("saveTimezoneAction", () => {
  let store: string;
  let roles: StoreRoles;

  beforeEach(async () => {
    ({ store, roles } = await makeStoreWithRoles("tz-action"));
    await db.insert(storeSettings).values({ storeId: store, timezone: "America/Los_Angeles" });
  });

  /** Signs in a new person holding the role (a key of StoreRoles), or none, working in the store. */
  async function signInAs(role: keyof StoreRoles | null) {
    const { userId } = await makePerson(store, role ? roles[role] : null);
    mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Van", email: `${userId}@example.com` }, session: { activeOrganizationId: store } });
    mocks.listOrganizations.mockResolvedValue([{ id: store, name: "Test" }]);
  }

  it("saves for a Store Manager, in words", async () => {
    await signInAs("store_manager");
    expect(await saveTimezoneAction("America/Denver", 1)).toEqual({ status: "saved", message: "Time zone saved" });
    expect(await storeSettingsFor(store)).toEqual({ timezone: "America/Denver", version: 2 });
  });

  it("makes the settings row for a Store Manager of a store that has none (version 0)", async () => {
    await db.delete(storeSettings).where(eq(storeSettings.storeId, store));
    await signInAs("store_manager");
    expect(await saveTimezoneAction("America/Denver", 0)).toEqual({ status: "saved", message: "Time zone saved" });
    expect(await saveTimezoneAction("America/Chicago", -1)).toEqual({ status: "refused", message: "Choose a time zone from the list." });
  });

  it.each(["assistant_manager", "vm_manager", "vm_worker", "sales_associate", null] as const)("refuses a member whose role is %s, in words, and changes nothing", async (role) => {
    await signInAs(role);
    expect(await saveTimezoneAction("America/Denver", 1)).toEqual(NOT_ALLOWED);
    expect(await storeSettingsFor(store)).toEqual({ timezone: "America/Los_Angeles", version: 1 });
  });

  it("refuses an unknown zone and a stale page, each in words", async () => {
    await signInAs("store_manager");
    expect(await saveTimezoneAction("Mars/Olympus", 1)).toEqual({ status: "refused", message: "Choose a time zone from the list." });
    expect(await saveTimezoneAction(42, "one")).toEqual({ status: "refused", message: "Choose a time zone from the list." });
    expect(await saveTimezoneAction("America/Denver", 1)).toEqual({ status: "saved", message: "Time zone saved" });
    expect(await saveTimezoneAction("America/Chicago", 1)).toEqual({ status: "refused", message: "Changed on another device" });
  });

  it("sends a signed-out visitor to sign in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(saveTimezoneAction("America/Denver", 1)).rejects.toThrow("redirect:/sign-in");
  });
});

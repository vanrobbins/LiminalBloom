// The real createStore action, with Better Auth and Next stood in for and the
// time zone write running against the dev database (like lib/store-settings.test.ts).
// The creator is a Store Manager, as the store-creation hook makes them.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(async () => []),
  createOrganization: vi.fn(),
  setActiveOrganization: vi.fn(),
  // Next's redirect() throws to stop the action; so does this stand-in.
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      listOrganizations: mocks.listOrganizations,
      createOrganization: mocks.createOrganization,
      setActiveOrganization: mocks.setActiveOrganization,
    },
  },
}));

// The real time zone write, which one test makes fail the way a dropped connection would.
const settings = vi.hoisted(() => ({ fail: null as Error | null }));
vi.mock("@/lib/store-settings", async (original) => {
  const real = await original<typeof import("@/lib/store-settings")>();
  return {
    ...real,
    setStoreTimezone: async (...args: Parameters<typeof real.setStoreTimezone>) => {
      if (settings.fail) throw settings.fail;
      return real.setStoreTimezone(...args);
    },
  };
});

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { storeSettings } from "@/db/schema";
import { dropPeople, makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";
import { storeSettingsFor } from "@/lib/store-settings";

import { createStore } from "./actions";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

/** What Better Auth and its afterCreateOrganization hook leave behind: a store, its five roles, its creator in `role`, Pacific. */
async function createdStore(role: "store_manager" | "sales_associate" = "store_manager"): Promise<{ storeId: string; userId: string }> {
  const { store: storeId, roles } = await makeStoreWithRoles("create-action");
  const { userId } = await makePerson(storeId, roles[role]);
  await db.insert(storeSettings).values({ storeId, timezone: "America/Los_Angeles" });
  mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Test person", email: `${userId}@example.com` }, session: { activeOrganizationId: storeId } });
  mocks.createOrganization.mockResolvedValue({ id: storeId });
  return { storeId, userId };
}

function form(name: string, timezone: string): FormData {
  const data = new FormData();
  data.set("name", name);
  data.set("timezone", timezone);
  return data;
}

beforeEach(() => vi.clearAllMocks());

describe("createStore", () => {
  it("gives the new store the time zone its creator chose", async () => {
    const { storeId } = await createdStore();
    await expect(createStore(null, form("Pioneer Place", "America/Denver"))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/home");
    expect(await storeSettingsFor(storeId)).toEqual({ timezone: "America/Denver", version: 2 });
  });

  it("stores the runtime's spelling of a zone the browser spelled differently", async () => {
    const { storeId } = await createdStore();
    await expect(createStore(null, form("Lloyd Center", "america/denver"))).rejects.toThrow("NEXT_REDIRECT");
    expect((await storeSettingsFor(storeId))?.timezone).toBe("America/Denver");
  });

  it("refuses a person whose role requires two-factor and who has none: no store is made, and the session isn't asked for further", async () => {
    const { userId } = await createdStore();
    await db.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, userId));
    expect(await createStore(null, form("Pioneer Place", "America/Denver"))).toEqual({ error: "Set up two-step sign-in on Account first." });
    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.setActiveOrganization).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in before anything else", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(createStore(null, form("Pioneer Place", "America/Denver"))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  it("refuses a zone that isn't one, before making any store", async () => {
    await createdStore();
    expect(await createStore(null, form("Pioneer Place", "Mars/Olympus"))).toEqual({ error: "Choose the store's time zone from the list." });
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  it("still makes the store, and says so in the log, when the zone can't be saved", async () => {
    const { storeId } = await createdStore("sales_associate");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createStore(null, form("Washington Square", "America/Denver"))).rejects.toThrow("NEXT_REDIRECT");
    expect(logged).toHaveBeenCalledWith("create-store: time zone not saved", storeId, "forbidden");
    expect(await storeSettingsFor(storeId)).toEqual({ timezone: "America/Los_Angeles", version: 1 });
    logged.mockRestore();
  });

  it("goes on to the store when the zone write throws, so a retry can't make a second store (B4)", async () => {
    const { storeId } = await createdStore();
    settings.fail = new Error("Connection terminated unexpectedly");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(createStore(null, form("Clackamas", "America/Denver"))).rejects.toThrow("NEXT_REDIRECT");
      expect(mocks.setActiveOrganization).toHaveBeenCalled();
      expect(mocks.redirect).toHaveBeenCalledWith("/home");
      expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
      expect(logged).toHaveBeenCalledWith("create-store: time zone not saved", storeId, settings.fail);
    } finally {
      settings.fail = null;
      logged.mockRestore();
    }
  });
});

// The real createStore action, with Better Auth and Next stood in for and the
// time zone write running against the dev database (like lib/store-settings.test.ts).

import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
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
      createOrganization: mocks.createOrganization,
      setActiveOrganization: mocks.setActiveOrganization,
    },
  },
}));

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { storeSettings } from "@/db/schema";
import { dropStores, makeStore } from "@/lib/products/test-stores";
import { storeSettingsFor } from "@/lib/store-settings";

import { createStore } from "./actions";

const users: string[] = [];
afterAll(async () => {
  await dropStores();
  if (users.length) await db.delete(user).where(inArray(user.id, users));
});

/** What Better Auth and its afterCreateOrganization hook leave behind: a store, its owner, Pacific. */
async function createdStore(role = "owner"): Promise<{ storeId: string; userId: string }> {
  const storeId = await makeStore("create-action");
  const userId = `test_cs_${randomUUID().slice(0, 8)}`;
  users.push(userId);
  await db.insert(user).values({ id: userId, name: role, email: `${userId}@example.com` });
  await db.insert(member).values({ id: randomUUID(), organizationId: storeId, userId, role, createdAt: new Date() });
  await db.insert(storeSettings).values({ storeId, timezone: "America/Los_Angeles" });
  mocks.getSession.mockResolvedValue({ user: { id: userId }, session: {} });
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
    expect(mocks.redirect).toHaveBeenCalledWith("/products");
    expect(await storeSettingsFor(storeId)).toEqual({ timezone: "America/Denver", version: 2 });
  });

  it("stores the runtime's spelling of a zone the browser spelled differently", async () => {
    const { storeId } = await createdStore();
    await expect(createStore(null, form("Lloyd Center", "america/denver"))).rejects.toThrow("NEXT_REDIRECT");
    expect((await storeSettingsFor(storeId))?.timezone).toBe("America/Denver");
  });

  it("refuses a zone that isn't one, before making any store", async () => {
    await createdStore();
    expect(await createStore(null, form("Pioneer Place", "Mars/Olympus"))).toEqual({ error: "Choose the store's time zone from the list." });
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  it("still makes the store, and says so in the log, when the zone can't be saved", async () => {
    const { storeId } = await createdStore("member");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createStore(null, form("Washington Square", "America/Denver"))).rejects.toThrow("NEXT_REDIRECT");
    expect(logged).toHaveBeenCalledWith("create-store: time zone not saved", storeId, "forbidden");
    expect(await storeSettingsFor(storeId)).toEqual({ timezone: "America/Los_Angeles", version: 1 });
    logged.mockRestore();
  });
});

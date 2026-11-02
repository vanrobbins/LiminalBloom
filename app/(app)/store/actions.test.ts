import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { storeSettings } from "@/db/schema";
import * as currentMember from "@/lib/current-member";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { saveTimezoneAction } from "./actions";

vi.mock("@/lib/current-member");
const ME = { id: `test_store_actions_${randomUUID().slice(0, 8)}`, name: "Van", email: "" };

afterAll(async () => {
  await dropStores();
  await db.delete(user).where(eq(user.id, ME.id));
});

describe("saveTimezoneAction", () => {
  let store: string;

  beforeEach(async () => {
    store = await makeStore(`tz-action-${randomUUID().slice(0, 6)}`);
    await db.insert(user).values({ ...ME, email: `${ME.id}-${store}@example.com` }).onConflictDoNothing();
    await db.insert(storeSettings).values({ storeId: store, timezone: "America/Los_Angeles" });
    vi.mocked(currentMember.requireMember).mockResolvedValue({ kind: "member", user: ME, stores: [{ id: store, name: "Test" }], activeStoreId: store });
  });

  const joinAs = (role: string) => db.insert(member).values({ id: randomUUID(), organizationId: store, userId: ME.id, role, createdAt: new Date() });

  it("saves for the owner, in words", async () => {
    await joinAs("owner");
    expect(await saveTimezoneAction("America/Denver", 1)).toEqual({ status: "saved", message: "Time zone saved" });
  });

  it("refuses a member, an unknown zone, and a stale page, each in words", async () => {
    await joinAs("member");
    expect(await saveTimezoneAction("America/Denver", 1)).toEqual({ status: "refused", message: "Only the store's owner or admins can change this." });
    expect(await saveTimezoneAction("Mars/Olympus", 1)).toEqual({ status: "refused", message: "Choose a time zone from the list." });
    expect(await saveTimezoneAction(42, "one")).toEqual({ status: "refused", message: "Choose a time zone from the list." });
  });
});

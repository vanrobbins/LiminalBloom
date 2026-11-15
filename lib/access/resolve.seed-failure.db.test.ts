// resolveAccess when the safety-net seeding throws (for example, a racing
// request seeded the store first and this insert hit a unique constraint).
// Separate from resolve.db.test.ts because ./seed is mocked for the whole file.

import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("./seed", () => ({
  giveStoreItsRoles: vi.fn(async () => {
    throw new Error("duplicate key value violates unique constraint");
  }),
}));

import { makeStore, dropStores } from "@/lib/products/test-stores";

import { resolveAccess } from "./resolve";
import { giveStoreItsRoles } from "./seed";
import { dropPeople, makePerson } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

describe("resolveAccess when seeding fails", () => {
  it("logs it, does not throw, and gives view only with no role", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = await makeStore("res-seedfail", { roles: false });
    const { userId } = await makePerson(store, null, "owner");

    const access = await resolveAccess(userId, store);

    expect(access.activeStoreId).toBe(store);
    expect(access.role).toBeNull();
    expect([...access.switches]).toEqual(["view"]);
    expect(giveStoreItsRoles).toHaveBeenCalledWith(store);
    expect(error).toHaveBeenCalledWith(expect.any(String), store, expect.objectContaining({ message: expect.stringContaining("unique constraint") }));
    error.mockRestore();
  });
});

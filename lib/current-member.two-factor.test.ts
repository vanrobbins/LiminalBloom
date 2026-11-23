// The "Requires two-factor" role setting at the guards (0.7.1a, A3b), with Better Auth, resolveAccess and the second-factor
// read stood in for (the real chain is lib/access/roles-two-factor.db.test.ts and app/(app)/store/roles/actions.test.ts).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  resolveAccess: vi.fn(),
  hasSecondFactor: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, listOrganizations: mocks.listOrganizations } } }));
vi.mock("@/lib/access/resolve", () => ({ resolveAccess: mocks.resolveAccess }));
vi.mock("@/lib/two-factor/has-second-factor", () => ({ hasSecondFactor: mocks.hasSecondFactor }));
vi.mock("@/lib/admin/is-admin", () => ({ isPlatformAdmin: async () => false }));
vi.mock("@/lib/paused", () => ({ pausedAmong: async () => new Set<string>(), pausedStoresOf: async () => [] }));

import { getCurrentMember, requireAccountPerson, requireMember, requireSwitch, requireSwitchForAction } from "./current-member";

const SESSION = { user: { id: "user-1", name: "Van", email: "van@example.com", image: null }, session: { activeOrganizationId: "store-b" } };
const STORE_ROWS = [{ id: "store-a", name: "Pioneer Place" }];
const MANAGER = { id: "role-1", name: "Store Manager", rank: 100, builtin: "store_manager" };
const SALES = { id: "role-5", name: "Sales Associate", rank: 500, builtin: "sales_associate" };

function signedIn(role: typeof MANAGER, switches: string[]) {
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.resolveAccess.mockResolvedValue({ activeStoreId: "store-a", role, switches: new Set(switches), requiresTwoFactor: false });
  mocks.listOrganizations.mockResolvedValue(STORE_ROWS);
}

beforeEach(() => vi.clearAllMocks());

// A role that "Requires two-factor" (0.7.1a, A3b): the account must have it, or nothing of the store is read or shown.
describe("a role that requires two-factor", () => {
  const requiring = (has: boolean) => {
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.resolveAccess.mockResolvedValue({ activeStoreId: "store-a", role: MANAGER, switches: new Set(["view", "people.manage"]), requiresTwoFactor: true });
    mocks.listOrganizations.mockResolvedValue(STORE_ROWS);
    mocks.hasSecondFactor.mockResolvedValue(has);
  };

  it("is not a member while the account has no second factor, and reads no store list", async () => {
    requiring(false);
    expect(await getCurrentMember()).toEqual({ kind: "needs-two-factor", user: { id: "user-1", name: "Van", email: "van@example.com" }, roleName: "Store Manager" });
    expect(mocks.hasSecondFactor).toHaveBeenCalledWith("user-1");
    expect(mocks.listOrganizations).not.toHaveBeenCalled();
  });

  it("is a member once the account has one", async () => {
    requiring(true);
    expect(await getCurrentMember()).toMatchObject({ kind: "member", activeStoreId: "store-a" });
  });

  it("never asks about the second factor for a role that does not require it", async () => {
    signedIn(SALES, ["view"]);
    expect(await getCurrentMember()).toMatchObject({ kind: "member" });
    expect(mocks.hasSecondFactor).not.toHaveBeenCalled();
  });

  it("sends every guard but the Account one to Account, which does not send them anywhere (no loop)", async () => {
    requiring(false);
    await expect(requireMember()).rejects.toThrow("redirect:/account");
    await expect(requireSwitch("view")).rejects.toThrow("redirect:/account");
    await expect(requireSwitchForAction("view")).rejects.toThrow("redirect:/account");
    mocks.redirect.mockClear();
    expect(await requireAccountPerson()).toMatchObject({ kind: "needs-two-factor" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("requireAccountPerson", () => {
  it("sends a signed-out visitor to sign in and a person with no store to welcome, and lets a member through", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireAccountPerson()).rejects.toThrow("redirect:/sign-in");
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.resolveAccess.mockResolvedValue({ activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false });
    await expect(requireAccountPerson()).rejects.toThrow("redirect:/welcome");
    signedIn(SALES, ["view"]);
    expect(await requireAccountPerson()).toMatchObject({ kind: "member" });
  });
});

// Paused stores at the guards (spec 0.7.1 7.4), with Better Auth, resolveAccess and the paused read stood in for
// (the real chain is lib/paused.db.test.ts and lib/admin/actions-pause.db.test.ts).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  resolveAccess: vi.fn(),
  pausedAmong: vi.fn(),
  pausedStoresOf: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, listOrganizations: mocks.listOrganizations } } }));
vi.mock("@/lib/access/resolve", () => ({ resolveAccess: mocks.resolveAccess }));
vi.mock("@/lib/two-factor/has-second-factor", () => ({ hasSecondFactor: async () => true }));
vi.mock("@/lib/admin/is-admin", () => ({ isPlatformAdmin: async () => false }));
vi.mock("@/lib/help/badge", () => ({ helpRepliesFor: async () => 0 }));
vi.mock("@/lib/paused", () => ({ pausedAmong: mocks.pausedAmong, pausedStoresOf: mocks.pausedStoresOf }));

import { getCurrentMember, requireAccountPerson, requireMember } from "./current-member";

const SESSION = { user: { id: "user-1", name: "Van", email: "van@example.com", image: null }, session: { activeOrganizationId: "store-b" } };
const USER = { id: "user-1", name: "Van", email: "van@example.com" };
const PAUSED = [{ id: "store-a", name: "Pioneer Place" }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.pausedAmong.mockResolvedValue(new Set());
  mocks.pausedStoresOf.mockResolvedValue([]);
});

describe("when nothing resolves", () => {
  beforeEach(() => mocks.resolveAccess.mockResolvedValue({ activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false }));

  it("is paused when the person belongs to a paused store, naming it", async () => {
    mocks.pausedStoresOf.mockResolvedValue(PAUSED);
    expect(await getCurrentMember()).toEqual({ kind: "paused", user: USER, stores: PAUSED });
    expect(mocks.pausedStoresOf).toHaveBeenCalledWith("user-1");
    expect(mocks.listOrganizations).not.toHaveBeenCalled();
  });

  it("is no-store when they belong to none", async () => {
    expect(await getCurrentMember()).toEqual({ kind: "no-store", user: USER });
  });

  it("sends requireMember and requireAccountPerson to /paused", async () => {
    mocks.pausedStoresOf.mockResolvedValue(PAUSED);
    await expect(requireMember()).rejects.toThrow("redirect:/paused");
    await expect(requireAccountPerson()).rejects.toThrow("redirect:/paused");
  });
});

describe("the shell's store list", () => {
  it("leaves a paused store out, asking about exactly the stores listed", async () => {
    mocks.resolveAccess.mockResolvedValue({ activeStoreId: "store-a", role: null, switches: new Set(["view"]), requiresTwoFactor: false });
    mocks.listOrganizations.mockResolvedValue([{ id: "store-a", name: "Pioneer Place" }, { id: "store-b", name: "Washington Square" }]);
    mocks.pausedAmong.mockResolvedValue(new Set(["store-b"]));
    expect(await getCurrentMember()).toMatchObject({ kind: "member", stores: [{ id: "store-a", name: "Pioneer Place" }] });
    expect(mocks.pausedAmong).toHaveBeenCalledWith(["store-a", "store-b"]);
  });
});

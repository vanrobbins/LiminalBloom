// Paused stores at the guards (spec 0.7.1 7.4), with Better Auth, resolveAccess and the paused read stood in for
// (the real chain is lib/paused.db.test.ts and lib/admin/actions-pause.db.test.ts).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  resolveAccess: vi.fn(),
  pausedAmong: vi.fn(),
  pausedStoresOf: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/access/resolve", () => ({ resolveAccess: mocks.resolveAccess }));
vi.mock("@/lib/two-factor/has-second-factor", () => ({ hasSecondFactor: async () => true }));
vi.mock("@/lib/admin/is-admin", () => ({ isPlatformAdmin: async () => false }));
vi.mock("@/lib/help/badge", () => ({ helpRepliesFor: async () => 0 }));
vi.mock("@/lib/paused", () => ({ pausedAmong: mocks.pausedAmong, pausedStoresOf: mocks.pausedStoresOf }));

import { getCurrentMember, requireAccountPerson, requireMember } from "./current-member";

const SESSION = { user: { id: "user-1", name: "Van", email: "van@example.com", image: null }, session: { activeStoreId: "store-b", activeOrganizationId: null } };
const USER = { id: "user-1", name: "Van", email: "van@example.com" };
const PAUSED = [{ id: "store-a", name: "Pioneer Place" }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.pausedAmong.mockResolvedValue(new Set());
  mocks.pausedStoresOf.mockResolvedValue([]);
});

describe("when nothing resolves", () => {
  beforeEach(() => mocks.resolveAccess.mockResolvedValue({ activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false, stores: [], company: null }));

  it("is paused when the person belongs to a paused store, naming it", async () => {
    mocks.pausedStoresOf.mockResolvedValue(PAUSED);
    expect(await getCurrentMember()).toEqual({ kind: "paused", user: USER, stores: PAUSED });
    expect(mocks.pausedStoresOf).toHaveBeenCalledWith("user-1");
  });

  it("is no-store when they belong to none", async () => {
    expect(await getCurrentMember()).toEqual({ kind: "no-store", user: USER });
  });

  it("sends requireMember to /paused, but lets requireAccountPerson through: Account stays theirs (DECISIONS 11-23)", async () => {
    mocks.pausedStoresOf.mockResolvedValue(PAUSED);
    await expect(requireMember()).rejects.toThrow("redirect:/paused");
    expect(await requireAccountPerson()).toEqual({ kind: "paused", user: USER, stores: PAUSED });
  });
});

describe("the shell's store list", () => {
  it("is exactly the stores resolveAccess reaches: a paused store never gets this far (grants.ts filters it)", async () => {
    const listed = { id: "store-a", name: "Pioneer Place", companyId: null, companyName: null, regionId: null, regionName: null };
    mocks.resolveAccess.mockResolvedValue({ activeStoreId: "store-a", role: null, switches: new Set(["view"]), requiresTwoFactor: false, stores: [listed], company: null });
    expect(await getCurrentMember()).toMatchObject({ kind: "member", stores: [{ id: "store-a", name: "Pioneer Place" }] });
    expect(mocks.pausedAmong).not.toHaveBeenCalled();
  });

  it("is company-only, not paused, for a company person whose personal stores are all paused", async () => {
    const company = { id: "co-1", name: "Acme", role: "owner", regionId: null, regionName: null, switches: [] };
    mocks.resolveAccess.mockResolvedValue({ activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false, stores: [], company });
    mocks.pausedStoresOf.mockResolvedValue(PAUSED);
    expect(await getCurrentMember()).toMatchObject({ kind: "company-only" });
    expect(mocks.pausedStoresOf).not.toHaveBeenCalled();
  });
});

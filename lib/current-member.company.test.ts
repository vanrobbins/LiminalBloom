// A person with a company role at the guards (spec 0.7.1, 4.2): the company and the store list with company and
// region names reach the member, and with no store that resolves they are company-only and sent to /company.
// Better Auth and resolveAccess are stood in for; the merge itself is in lib/access/resolve-company.db.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  resolveAccess: vi.fn(),
  isPlatformAdmin: vi.fn(),
  // Next's redirect() throws to stop rendering; so does this stand-in.
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/access/resolve", () => ({ resolveAccess: mocks.resolveAccess }));
vi.mock("@/lib/two-factor/has-second-factor", () => ({ hasSecondFactor: async () => true }));
vi.mock("@/lib/admin/is-admin", () => ({ isPlatformAdmin: mocks.isPlatformAdmin }));
vi.mock("@/lib/help/badge", () => ({ helpRepliesFor: async () => 0 }));
vi.mock("@/lib/paused", () => ({ pausedStoresOf: async () => [] }));

import { getCurrentMember, requireAccountPerson, requireMember, requireSignedIn } from "./current-member";

const SESSION = {
  user: { id: "user-1", name: "Van", email: "van@example.com", image: null },
  session: { activeStoreId: "store-b", activeOrganizationId: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isPlatformAdmin.mockResolvedValue(false);
});

describe("a person with a company role", () => {
  const COMPANY = { id: "co-1", name: "Acme", role: "corporate_admin", regionId: null, regionName: null, switches: ["company.settings", "company.structure", "company.people"] };
  const ACME_STORES = [
    { id: "store-a", name: "Pioneer Place", companyId: "co-1", companyName: "Acme", regionId: "r-1", regionName: "North" },
    { id: "store-b", name: "Washington Square", companyId: null, companyName: null, regionId: null, regionName: null },
  ];

  it("carries the company and the stores with company and region names, and no region id", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.resolveAccess.mockResolvedValue({ activeStoreId: "store-a", role: { id: "company:corporate_admin", name: "Corporate Admin", rank: 20, builtin: null }, switches: new Set(["view"]), requiresTwoFactor: false, stores: ACME_STORES, company: COMPANY });
    expect(await getCurrentMember()).toMatchObject({
      kind: "member",
      company: COMPANY,
      role: { id: "company:corporate_admin", name: "Corporate Admin", rank: 20 },
      stores: [
        { id: "store-a", name: "Pioneer Place", companyId: "co-1", companyName: "Acme", regionName: "North" },
        { id: "store-b", name: "Washington Square", companyId: null, companyName: null, regionName: null },
      ],
    });
    const stores = ((await getCurrentMember()) as { stores: object[] }).stores;
    for (const s of stores) expect(s).not.toHaveProperty("regionId");
  });

  it("is company-only when no store resolves, with the company, and does not ask who is paused", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.resolveAccess.mockResolvedValue({ activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false, stores: [], company: COMPANY });
    expect(await getCurrentMember()).toEqual({ kind: "company-only", user: { id: "user-1", name: "Van", email: "van@example.com" }, company: COMPANY });
    expect(mocks.isPlatformAdmin).not.toHaveBeenCalled();
  });

  it("sends requireMember to /company, but lets requireAccountPerson through: Account is theirs too", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.resolveAccess.mockResolvedValue({ activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false, stores: [], company: COMPANY });
    await expect(requireMember()).rejects.toThrow("redirect:/company");
    expect(await requireAccountPerson()).toMatchObject({ kind: "company-only", user: { id: "user-1" } });
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(await requireSignedIn()).toMatchObject({ kind: "company-only" });
  });
});

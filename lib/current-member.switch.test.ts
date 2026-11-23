// Tests for who a request belongs to and what they may do. The membership rule
// is tested against the real database in active-store.test.ts and the role read
// in lib/access/resolve.db.test.ts; here Better Auth and resolveAccess are stood
// in for, to pin down what each kind of visitor gets.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  resolveAccess: vi.fn(),
  isPlatformAdmin: vi.fn(),
  helpReplies: vi.fn(),
  // Next's redirect() throws to stop rendering; so does this stand-in.
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      listOrganizations: mocks.listOrganizations,
    },
  },
}));
vi.mock("@/lib/access/resolve", () => ({
  resolveAccess: mocks.resolveAccess,
}));
vi.mock("@/lib/two-factor/has-second-factor", () => ({ hasSecondFactor: async () => true }));
vi.mock("@/lib/admin/is-admin", () => ({ isPlatformAdmin: mocks.isPlatformAdmin }));
vi.mock("@/lib/help/badge", () => ({ helpRepliesFor: mocks.helpReplies }));
// Paused stores are tested in current-member.paused.test.ts; here nothing is paused.
vi.mock("@/lib/paused", () => ({ pausedAmong: async () => new Set<string>(), pausedStoresOf: async () => [] }));

import { can, getCurrentMember, requireMember, requireSignedIn, requireSwitch, requireSwitchForAction } from "./current-member";

const SESSION = {
  user: { id: "user-1", name: "Van", email: "van@example.com", image: null },
  session: { activeOrganizationId: "store-b" },
};

const STORE_ROWS = [
  { id: "store-a", name: "Pioneer Place", slug: "pioneer-place", logo: null, metadata: null },
  { id: "store-b", name: "Washington Square", slug: "washington-square", logo: null, metadata: null },
];

const MANAGER = { id: "role-1", name: "Store Manager", rank: 100, builtin: "store_manager" };
const SALES = { id: "role-5", name: "Sales Associate", rank: 500, builtin: "sales_associate" };

/** What resolveAccess says for a person in `store` holding `role` and `switches`. */
function access(store: string | null, role: typeof MANAGER | null, switches: string[]) {
  mocks.resolveAccess.mockResolvedValue({ activeStoreId: store, role, switches: new Set(switches) });
}

/** A signed-in member of `store` holding `role` and `switches`, with the store list the shell shows. */
function signedIn(store: string, role: typeof MANAGER | null, switches: string[]) {
  mocks.getSession.mockResolvedValue(SESSION);
  access(store, role, switches);
  mocks.listOrganizations.mockResolvedValue(STORE_ROWS);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isPlatformAdmin.mockResolvedValue(false);
  mocks.helpReplies.mockResolvedValue(0);
});

describe("requireSwitch", () => {
  it("sends a signed-out visitor to sign in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireSwitch("products.edit")).rejects.toThrow("redirect:/sign-in");
  });

  it("sends a person with no store to the welcome page (accept an invitation or create a store)", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    access(null, null, []);
    await expect(requireSwitch("products.edit")).rejects.toThrow("redirect:/welcome");
  });

  it("returns the member who holds the switch", async () => {
    signedIn("store-b", MANAGER, ["view", "products.edit"]);

    const member = await requireSwitch("products.edit");

    expect(member.activeStoreId).toBe("store-b");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("sends a member without the switch to the no-access page, once", async () => {
    signedIn("store-b", SALES, ["view", "products.stock"]);

    await expect(requireSwitch("products.edit")).rejects.toThrow("redirect:/no-access");
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
  });
});

describe("requireSwitchForAction", () => {
  it("still sends a signed-out visitor to sign in, and a person with no store to create one", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireSwitchForAction("products.edit")).rejects.toThrow("redirect:/sign-in");

    mocks.getSession.mockResolvedValue(SESSION);
    access(null, null, []);
    await expect(requireSwitchForAction("products.edit")).rejects.toThrow("redirect:/welcome");
  });

  it("returns the member who holds the switch", async () => {
    signedIn("store-b", MANAGER, ["view", "store.settings"]);

    const result = await requireSwitchForAction("store.settings");

    expect(result).toMatchObject({ status: "ok", member: { kind: "member", activeStoreId: "store-b" } });
  });

  it("returns a forbidden signal, and redirects nowhere, for a member without it", async () => {
    signedIn("store-b", SALES, ["view"]);

    expect(await requireSwitchForAction("store.settings")).toEqual({ status: "forbidden" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

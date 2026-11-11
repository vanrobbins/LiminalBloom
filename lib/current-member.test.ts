// Tests for who a request belongs to and what they may do. The membership rule
// is tested against the real database in active-store.test.ts and the role read
// in lib/access/resolve.db.test.ts; here Better Auth and resolveAccess are stood
// in for, to pin down what each kind of visitor gets.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  resolveAccess: vi.fn(),
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

import { can, getCurrentMember, requireMember, requireSwitch, requireSwitchForAction } from "./current-member";

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
});

describe("getCurrentMember", () => {
  it("is signed out without a session, and asks nothing more", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(await getCurrentMember()).toEqual({ kind: "signed-out" });
    expect(mocks.resolveAccess).not.toHaveBeenCalled();
    expect(mocks.listOrganizations).not.toHaveBeenCalled();
  });

  it("has no store when membership resolves to none", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    access(null, null, []);

    expect(await getCurrentMember()).toEqual({ kind: "no-store" });
    expect(mocks.resolveAccess).toHaveBeenCalledWith("user-1", "store-b");
    expect(mocks.listOrganizations).not.toHaveBeenCalled();
  });

  it("is a member working in the membership-checked store", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    // The session named store-b, but the check fell back to store-a.
    access("store-a", MANAGER, ["view", "store.settings"]);
    mocks.listOrganizations.mockResolvedValue(STORE_ROWS);

    expect(await getCurrentMember()).toEqual({
      kind: "member",
      user: { id: "user-1", name: "Van", email: "van@example.com" },
      // Only what the shell shows: no slugs, logos or metadata.
      stores: [
        { id: "store-a", name: "Pioneer Place" },
        { id: "store-b", name: "Washington Square" },
      ],
      activeStoreId: "store-a",
      // Plain values for client components: no `builtin`, switches as an array.
      role: { id: "role-1", name: "Store Manager", rank: 100 },
      switches: ["view", "store.settings"],
    });
  });

  it("carries no role and view only for a member with no role", async () => {
    signedIn("store-a", null, ["view"]);

    const member = await getCurrentMember();
    expect(member).toMatchObject({ kind: "member", role: null, switches: ["view"] });
  });
});

describe("can", () => {
  it("tests a member's switches", async () => {
    signedIn("store-a", MANAGER, ["view", "store.settings"]);

    const member = await requireMember();
    expect(can(member, "store.settings")).toBe(true);
    expect(can(member, "products.edit")).toBe(false);
  });
});

describe("requireMember", () => {
  it("sends a signed-out visitor to sign in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireMember()).rejects.toThrow("redirect:/sign-in");
  });

  it("sends a person with no store to create one", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    access(null, null, []);
    await expect(requireMember()).rejects.toThrow("redirect:/create-store");
  });

  it("returns the member and redirects nowhere", async () => {
    signedIn("store-b", SALES, ["view"]);

    const member = await requireMember();

    expect(member.activeStoreId).toBe("store-b");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("requireSwitch", () => {
  it("sends a signed-out visitor to sign in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireSwitch("products.edit")).rejects.toThrow("redirect:/sign-in");
  });

  it("sends a person with no store to create one", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    access(null, null, []);
    await expect(requireSwitch("products.edit")).rejects.toThrow("redirect:/create-store");
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
    await expect(requireSwitchForAction("products.edit")).rejects.toThrow("redirect:/create-store");
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

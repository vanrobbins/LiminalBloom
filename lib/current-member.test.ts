// Tests for who a request belongs to. The membership rule itself is tested
// against the real database in active-store.test.ts; here Better Auth and
// that rule are stood in for, to pin down what each kind of visitor gets.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  resolveActiveStore: vi.fn(),
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
vi.mock("@/lib/active-store", () => ({
  resolveActiveStore: mocks.resolveActiveStore,
}));

import { getCurrentMember, requireMember } from "./current-member";

const SESSION = {
  user: { id: "user-1", name: "Van", email: "van@example.com", image: null },
  session: { activeOrganizationId: "store-b" },
};

const STORE_ROWS = [
  { id: "store-a", name: "Pioneer Place", slug: "pioneer-place", logo: null, metadata: null },
  { id: "store-b", name: "Washington Square", slug: "washington-square", logo: null, metadata: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentMember", () => {
  it("is signed out without a session, and asks nothing more", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(await getCurrentMember()).toEqual({ kind: "signed-out" });
    expect(mocks.resolveActiveStore).not.toHaveBeenCalled();
    expect(mocks.listOrganizations).not.toHaveBeenCalled();
  });

  it("has no store when membership resolves to none", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.resolveActiveStore.mockResolvedValue(null);

    expect(await getCurrentMember()).toEqual({ kind: "no-store" });
    expect(mocks.resolveActiveStore).toHaveBeenCalledWith("user-1", "store-b");
    expect(mocks.listOrganizations).not.toHaveBeenCalled();
  });

  it("is a member working in the membership-checked store", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    // The session named store-b, but the check fell back to store-a.
    mocks.resolveActiveStore.mockResolvedValue("store-a");
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
    });
  });
});

describe("requireMember", () => {
  it("sends a signed-out visitor to sign in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireMember()).rejects.toThrow("redirect:/sign-in");
  });

  it("sends a person with no store to create one", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.resolveActiveStore.mockResolvedValue(null);
    await expect(requireMember()).rejects.toThrow("redirect:/create-store");
  });

  it("returns the member and redirects nowhere", async () => {
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.resolveActiveStore.mockResolvedValue("store-b");
    mocks.listOrganizations.mockResolvedValue(STORE_ROWS);

    const member = await requireMember();

    expect(member.activeStoreId).toBe("store-b");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

// requireCompanyPerson sends everyone without a company role where they belong, including a person whose company is
// paused (the role is dropped while it is): Home, not /no-access, when they still have a standalone store.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ current: vi.fn(), paused: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-member", () => ({ getCurrentMember: mocks.current }));
vi.mock("@/lib/paused", () => ({ pausedStoresOf: mocks.paused }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import { requireCompanyPerson } from "./guard";

const USER = { id: "u1", name: "Ana", email: "ana@example.com" };
const company = { id: "c1", name: "Acme", role: "corporate_admin", regionId: null, regionName: null, switches: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.paused.mockResolvedValue([]);
});

describe("requireCompanyPerson", () => {
  it("lets a member with a company role in", async () => {
    mocks.current.mockResolvedValue({ kind: "member", user: USER, company, activeStoreId: "s1" });
    expect(await requireCompanyPerson()).toMatchObject({ kind: "member", activeStoreId: "s1" });
  });

  it("sends a store member with no company role to /no-access", async () => {
    mocks.current.mockResolvedValue({ kind: "member", user: USER, company: null, activeStoreId: "s1" });
    await expect(requireCompanyPerson()).rejects.toThrow("redirect:/no-access");
  });

  it("sends a store member whose company is paused to Home, not /no-access", async () => {
    mocks.current.mockResolvedValue({ kind: "member", user: USER, company: null, activeStoreId: "s1" });
    mocks.paused.mockResolvedValue([{ id: "c1", name: "Acme", kind: "company" }]);
    await expect(requireCompanyPerson()).rejects.toThrow("redirect:/home");
  });

  it("sends a person with nothing open to /paused", async () => {
    mocks.current.mockResolvedValue({ kind: "paused" });
    await expect(requireCompanyPerson()).rejects.toThrow("redirect:/paused");
  });
});

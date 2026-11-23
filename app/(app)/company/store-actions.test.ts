// addStoreAction's answer about the session: `activeSet` is true only when setActiveStore moved it into the new
// store; a refusal or a throw from it still leaves the store added, so the reply says so (the dialog stays put).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCompany: vi.fn(),
  getSession: vi.fn(),
  addCompanyStore: vi.fn(),
  setActiveStore: vi.fn(),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, createOrganization: vi.fn() } } }));
vi.mock("@/lib/companies/guard", () => ({ requireCompanyForAction: mocks.requireCompany }));
vi.mock("@/lib/companies/store-add", () => ({ addCompanyStore: mocks.addCompanyStore }));
vi.mock("@/lib/access/set-active-store", () => ({ setActiveStore: mocks.setActiveStore }));

import { addStoreAction } from "./store-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCompany.mockResolvedValue({ status: "ok", person: { user: { id: "u", name: "Van" }, company: { id: "c" } } });
  mocks.getSession.mockResolvedValue({ session: { id: "sess" } });
  mocks.addCompanyStore.mockResolvedValue({ status: "added", storeId: "s9" });
});

describe("addStoreAction", () => {
  it("says the session is in the new store when setActiveStore switched it", async () => {
    mocks.setActiveStore.mockResolvedValue({ status: "switched" });
    expect(await addStoreAction("Outlet", "America/New_York", null)).toEqual({ status: "added", storeId: "s9", activeSet: true });
  });

  it("still says added, with activeSet false, when setActiveStore refuses", async () => {
    mocks.setActiveStore.mockResolvedValue({ status: "forbidden" });
    expect(await addStoreAction("Outlet", "America/New_York", null)).toEqual({ status: "added", storeId: "s9", activeSet: false });
  });

  it("still says added, with activeSet false, when setActiveStore throws", async () => {
    mocks.setActiveStore.mockRejectedValue(new Error("db down"));
    expect(await addStoreAction("Outlet", "America/New_York", null)).toEqual({ status: "added", storeId: "s9", activeSet: false });
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/current-member", () => ({
  requireMember: async () => ({ kind: "member", user: { id: "u", name: "Van", email: "v@x.co" }, stores: [{ id: "a", name: "Pioneer Place" }], activeStoreId: "a" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import AccountPage from "./page";

describe("AccountPage", () => {
  it("offers Create a store to someone in one store", async () => {
    render(await AccountPage());
    expect(screen.getByRole("link", { name: "Create a store" })).toHaveAttribute("href", "/create-store");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ switches: ["view", "store.settings"] as string[] }));

vi.mock("@/lib/current-member", () => ({
  requireMember: async () => ({ kind: "member", user: { id: "u", name: "Van", email: "v@x.co" }, stores: [{ id: "a", name: "Pioneer Place" }, { id: "b", name: "Other" }], activeStoreId: "a", switches: mocks.switches }),
  can: (member: { switches: string[] }, wanted: string) => member.switches.includes(wanted),
}));
vi.mock("@/lib/store-settings", () => ({ storeSettingsFor: async () => ({ timezone: "America/Los_Angeles", version: 1 }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({ renameStoreAction: vi.fn(), saveTimezoneAction: vi.fn() }));

import StorePage from "./page";

describe("StorePage store name", () => {
  it("is an editable field, filled with the working store's name, for someone with store.settings", async () => {
    mocks.switches = ["view", "store.settings"];
    render(await StorePage());
    expect(screen.getByLabelText("Store name")).toHaveValue("Pioneer Place");
    // Both fields save as they are changed: no Save buttons on the page.
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(screen.getByLabelText("Time zone", { selector: "select" })).toBeInTheDocument();
  });

  it("is read-only text with the reason for everyone else", async () => {
    mocks.switches = ["view"];
    render(await StorePage());
    expect(screen.queryByLabelText("Store name")).toBeNull();
    expect(screen.getByText("Pioneer Place")).toBeInTheDocument();
    expect(screen.getAllByText("Your role can't change this.")).toHaveLength(2);
  });
});

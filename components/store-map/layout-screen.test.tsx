import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fixture, store } from "@/lib/layout/test-layouts";

import { LayoutScreen } from "./layout-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const props = { storeId: "s", layout: { ...store(), fixtures: [fixture()] }, planograms: {}, looks: {}, save: vi.fn(), fetchLatest: vi.fn() };

describe("LayoutScreen", () => {
  it("+ Add switches to editing in the same place, with the Add panel open (A3)", async () => {
    render(<LayoutScreen {...props} />);
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Add to the map" })).toBeInTheDocument();
  });

  it("Edit switches to editing without the panel", async () => {
    render(<LayoutScreen {...props} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add to the map" })).toBeNull();
  });
});

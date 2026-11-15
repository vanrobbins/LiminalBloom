import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fixture, store } from "@/lib/layout/test-layouts";

import { EVERYTHING } from "@/lib/access/test-guard";
import { LayoutScreen } from "./layout-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const props = { storeId: "s", layout: { ...store(), fixtures: [fixture()] }, planograms: {}, looks: {}, save: vi.fn(), fetchLatest: vi.fn() };

describe("LayoutScreen", () => {
  it("has no + Add until you are editing (DECISIONS 11-11)", async () => {
    render(<LayoutScreen member={EVERYTHING} {...props} />);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("has no Edit without layout.edit", () => {
    render(<LayoutScreen member={{ switches: ["view", "planograms.draft"] }} {...props} />);
    expect(screen.getByRole("heading", { name: "Store layout" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("Edit switches to editing without the panel", async () => {
    render(<LayoutScreen member={EVERYTHING} {...props} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add to the map" })).toBeNull();
  });
});

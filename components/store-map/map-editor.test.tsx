import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fixture, store } from "@/lib/layout/test-layouts";
import { EMPTY_LAYOUT } from "@/lib/layout/types";

import { MapEditor } from "./map-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const actions = { save: vi.fn(), fetchLatest: vi.fn() };

describe("MapEditor", () => {
  it("shows the map, Done, undo and redo", () => {
    render(<MapEditor storeId="s" initialLayout={{ ...store(), fixtures: [fixture()] }} {...actions} />);
    expect(screen.getByRole("img", { name: /Store layout: 0 zones, 1 fixture/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("asks for the outline on a store that has none", () => {
    render(<MapEditor storeId="s" initialLayout={EMPTY_LAYOUT} {...actions} />);
    expect(screen.getByRole("dialog", { name: "Set up your store" })).toBeInTheDocument();
  });

  it("tells a desktop user what the empty properties panel is for", () => {
    render(<MapEditor storeId="s" initialLayout={{ ...store(), fixtures: [fixture()] }} {...actions} />);
    expect(screen.getByText("Select something to see its properties.")).toBeInTheDocument();
  });
});

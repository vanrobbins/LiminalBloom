import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fixture, store, zone } from "@/lib/layout/test-layouts";

import { MapViewer } from "./map-viewer";

const media = vi.hoisted(() => ({ wide: false }));
vi.mock("./use-media-query", () => ({
  PHONE_QUERY: "(max-width: 767px)",
  useMediaQuery: (query: string) => (query === "(min-width: 1024px)" ? media.wide : query === "(pointer: fine)"),
}));

const layout = { ...store(), zones: [zone()], fixtures: [fixture()] };

describe("MapViewer", () => {
  it("shows the labelled map, says Select on a mouse", () => {
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" />);
    expect(screen.getByRole("img", { name: "Store layout: 1 zone, 1 fixture, 0 entrances" })).toBeInTheDocument();
    expect(screen.getByText(/^Select a zone/)).toBeInTheDocument();
  });

  it("lists everything on the map beside it on desktop (UX audit U7)", () => {
    media.wide = true;
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" />);
    expect(screen.getByRole("navigation", { name: "Everything on the map" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "List" })).toBeNull();
    media.wide = false;
  });

  it("opens the list in a sheet below desktop", async () => {
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" />);
    expect(screen.queryByRole("navigation", { name: "Everything on the map" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("dialog", { name: "Everything on the map" })).toBeInTheDocument();
  });
});

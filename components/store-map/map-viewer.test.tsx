import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixture, store, zone } from "@/lib/layout/test-layouts";

import { MapViewer } from "./map-viewer";

const media = vi.hoisted(() => ({ wide: false }));
vi.mock("./use-media-query", () => ({
  PHONE_QUERY: "(max-width: 767px)",
  useMediaQuery: (query: string) => (query === "(min-width: 1024px)" ? media.wide : query === "(pointer: fine)"),
}));

const layout = { ...store(), zones: [zone()], fixtures: [fixture()] };

describe("MapViewer", () => {
  it("shows the labelled map, has no hint row", () => {
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" />);
    expect(screen.getByRole("img", { name: "Store layout: 1 zone, 1 fixture, 0 entrances" })).toBeInTheDocument();
    expect(screen.queryByText(/look inside it/)).toBeNull();
  });

  it("an empty map says so over the map, not in a row of its own that pushes the page past the screen", () => {
    render(<MapViewer layout={{ ...store(), zones: [], fixtures: [] }} planograms={{}} looks={{}} storeKey="s" />);
    const line = screen.getByText("Nothing on the map yet.");
    expect(line.closest(".overflow-hidden")).not.toBeNull();
    expect(line).toHaveClass("absolute");
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

describe("MapViewer entry zone (/layout?zone=, 0.7.0.8)", () => {
  beforeEach(() => window.history.replaceState(null, "", "/layout"));

  it("starts focused on a known zone: its name and Whole store show", () => {
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" initialZone="zone-a" />);
    expect(screen.getByRole("heading", { name: "Front tables" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Whole store" })).toBeInTheDocument();
  });

  it("shows the whole store for a zone that is not on this map", () => {
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" initialZone="zone-elsewhere" />);
    expect(screen.queryByRole("button", { name: "Whole store" })).toBeNull();
  });

  it("shows the whole store with no entry zone", () => {
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" />);
    expect(screen.queryByRole("button", { name: "Whole store" })).toBeNull();
  });

  it("drops zone from the address on mount and keeps the other params", () => {
    window.history.replaceState(null, "", "/layout?zone=zone-a&x=1");
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" initialZone="zone-a" />);
    expect(window.location.pathname + window.location.search).toBe("/layout?x=1");
  });

  it("cleans the address for an unknown zone too", () => {
    window.history.replaceState(null, "", "/layout?zone=zone-elsewhere");
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" initialZone="zone-elsewhere" />);
    expect(window.location.search).toBe("");
  });

  it("drops the nonce with it", () => {
    window.history.replaceState(null, "", "/layout?zone=zone-a&n=k3");
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" initialZone="zone-a" />);
    expect(window.location.search).toBe("");
  });

  it("leaves a plain /layout address alone", () => {
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" />);
    expect(window.location.pathname + window.location.search).toBe("/layout");
  });

  it("Whole store from the entry zone goes back to the overview", async () => {
    render(<MapViewer layout={layout} planograms={{}} looks={{}} storeKey="s" initialZone="zone-a" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Whole store" }));
    expect(screen.queryByRole("button", { name: "Whole store" })).toBeNull();
  });
});

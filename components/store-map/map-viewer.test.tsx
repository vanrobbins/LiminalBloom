import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fixture, store, zone } from "@/lib/layout/test-layouts";

import { MapViewer } from "./map-viewer";

describe("MapViewer", () => {
  it("shows the labelled map and a way into the editor", () => {
    render(<MapViewer layout={{ ...store(), zones: [zone()], fixtures: [fixture()] }} />);
    expect(screen.getByRole("img", { name: "Store layout: 1 zone, 1 fixture, 0 entrances" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit layout" })).toHaveAttribute("href", "/layout/edit");
  });
});

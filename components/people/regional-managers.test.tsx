import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RegionalManagerRow } from "@/lib/access/people-view";

import { RegionalManagers } from "./regional-managers";

describe("RegionalManagers", () => {
  it("draws nothing for a store with no regional managers", () => {
    const { container } = render(<RegionalManagers managers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names each regional manager under a count, marking the viewer, with no address when none is sent", () => {
    const managers: RegionalManagerRow[] = [
      { name: "Rhea North", email: null, isYou: false },
      { name: "Pat Viewer", email: null, isYou: true },
    ];
    render(<RegionalManagers managers={managers} />);
    expect(screen.getByRole("heading", { level: 2, name: "Regional Manager · 2" })).toBeInTheDocument();
    expect(screen.getByText("Rhea North")).toBeInTheDocument();
    expect(screen.getByText("Pat Viewer")).toHaveTextContent("(you)");
    expect(document.body.textContent).not.toContain("@");
  });

  it("shows the address it was sent, for someone who may manage people", () => {
    render(<RegionalManagers managers={[{ name: "Rhea North", email: "rhea@example.com", isYou: false }]} />);
    expect(screen.getByText("rhea@example.com")).toBeInTheDocument();
  });
});

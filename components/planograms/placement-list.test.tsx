import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanogramFace } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { PlacementList } from "./placement-list";

const top: PlanogramFace = { faceId: "top", fixtureId: "t", fixtureName: "Table 1", side: "top", setSide: null, label: "Top", columns: 6, rows: 3 };
const item = (id: string, faceId: string, productName: string): GridItem => ({ id, faceId, productId: id, productName, presentation: "folded", pieceCount: 2, col: 0, row: 0, colSpan: 2, rowSpan: 2 });

describe("PlacementList", () => {
  it("lists placements whose face left the set in their own group, and opens them", async () => {
    const onSelect = vi.fn();
    const gone = item("g", "front-lower", "Crew Sock");
    render(
      <PlacementList
        faces={[top]}
        items={[item("p", "top", "High-Rise Pant"), gone]}
        orphans={[gone]}
        issues={new Map([["g", "No longer in this set"]])}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("table", { name: "Placements" })).toHaveTextContent("High-Rise Pant");
    const orphans = screen.getByRole("table", { name: "No longer in this set" });
    expect(orphans).toHaveTextContent("Crew Sock");
    await userEvent.click(screen.getByRole("button", { name: "Edit Crew Sock" }));
    expect(onSelect).toHaveBeenCalledWith("g");
  });

  it("has no such group when every placement is in the set", () => {
    render(<PlacementList faces={[top]} items={[item("p", "top", "High-Rise Pant")]} />);
    expect(screen.queryByRole("table", { name: "No longer in this set" })).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlacementView, PlanogramFace } from "@/lib/planograms/types";

import { PlacementEditor } from "./placement-panel";

vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

const top: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "t", fixtureName: "Table 1", side: "top", setSide: null, label: "Top", columns: 6, rows: 3 };
const placement: PlacementView = {
  id: "p", productId: "pr", productName: "Pocket Tee", styleNumber: "PT-1", stackLimit: 8, version: 1, imageKey: null, categoryName: "Denim",
  faceId: top.faceId, presentation: "hung", col: 0, row: 0, colSpan: 1, rowSpan: 3, pieceCount: 20,
};

function renderPanel(over: Partial<PlacementView> = {}, onSave = vi.fn().mockResolvedValue(null), onRemove = vi.fn()) {
  render(<PlacementEditor placement={{ ...placement, ...over }} isGone={false} faces={[top]} others={[]} busy={false} onClose={vi.fn()} onSave={onSave} onRemove={onRemove} />);
  return { onSave, onRemove };
}

describe("PlacementEditor", () => {
  it("says so when the other device removed the open placement", () => {
    render(<PlacementEditor placement={null} isGone faces={[]} others={[]} busy={false} onClose={vi.fn()} onSave={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Removed on another device")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("a placement whose face left the set can only be removed", async () => {
    const { onRemove } = renderPanel({ faceId: "00000000-0000-4000-8000-0000000000ff" });
    expect(screen.getByText("No longer in this set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "p" }));
  });

  it("checks hung → folded against the folded stack limit", async () => {
    const { onSave } = renderPanel();
    await userEvent.click(screen.getByRole("radio", { name: "Folded" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("More than this product's stack limit (8)");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows the server's refusal in the panel, not only behind it", async () => {
    renderPanel({}, vi.fn().mockResolvedValue("Changed on another device"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Changed on another device");
  });
});

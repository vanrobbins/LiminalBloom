import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlanogramFace } from "@/lib/planograms/types";

import { FacePicker } from "./face-picker";

const face = (faceId: string, label: string): PlanogramFace => ({ faceId, fixtureId: "r", fixtureName: "Rack", fixtureType: "rack", side: "front", setSide: null, label, columns: 8, rows: 3 });
const faces = [face("a", "Front"), face("b", "Back")];

describe("FacePicker", () => {
  it("shows nothing for one face", () => {
    const { container } = render(<FacePicker faces={[faces[0]]} currentFaceId="a" spot="a|0|0" onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the refusal beside the choice, and drops it once the placement has moved (face or position)", async () => {
    const onPick = vi.fn().mockResolvedValue("No open spot fits on Back");
    const { rerender } = render(<FacePicker faces={faces} currentFaceId="a" spot="a|0|0" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No open spot fits on Back");
    // Another device moved it along the same face: the reason was about where it was.
    rerender(<FacePicker faces={faces} currentFaceId="a" spot="a|3|0" onPick={onPick} />);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("keeps the refusal while nothing about the placement has changed", async () => {
    const onPick = vi.fn().mockResolvedValue("No open spot fits on Back");
    const { rerender } = render(<FacePicker faces={faces} currentFaceId="a" spot="a|0|0" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    rerender(<FacePicker faces={faces} currentFaceId="a" spot="a|0|0" onPick={onPick} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No open spot fits on Back");
  });
});

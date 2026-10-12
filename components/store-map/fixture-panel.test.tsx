import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Layout } from "@/lib/layout/types";
import { face, fixture, store, zone } from "@/lib/layout/test-layouts";
import type { FloorPlanogram, SnapshotEntry } from "@/lib/planograms/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("./use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import { FixturePanel } from "./fixture-panel";

const layout: Layout = {
  ...store(),
  zones: [zone()],
  fixtures: [fixture({ zoneId: "zone-a" }), fixture({ id: "man", type: "mannequin", name: "Mannequin 1" })],
  faces: [face()],
};
const entry: SnapshotEntry = {
  faceId: "face-a", faceLabel: "Top", side: "top", fixtureId: "fixture-a", fixtureName: "Table 1", productId: "tee", productName: "Pocket Tee", styleNumber: "PT-1",
  col: 0, row: 0, colSpan: 2, rowSpan: 1, presentation: "folded", pieceCount: 4,
};
const looks = { tee: { imageKey: null, categoryName: "Tops" } };
const panel = (planograms: Record<string, FloorPlanogram>, fixtureId = "fixture-a") => render(<FixturePanel layout={layout} fixtureId={fixtureId} planograms={planograms} looks={looks} />);

describe("FixturePanel", () => {
  it("says what the fixture is, how big, and where", () => {
    panel({});
    expect(screen.getByText("Table · 6′ × 3′ · Front tables")).toBeInTheDocument();
  });

  it("shows the published planogram and a way to edit it", () => {
    panel({ "fixture-a": { hasDraft: false, dueDate: null, latest: { number: 1, placements: [entry] } } });
    expect(screen.getByRole("region", { name: /Table 1, Top: 1 product/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit planogram" })).toHaveAttribute("href", "/planograms/fixture-a");
  });

  it("notes a draft in progress and its due date", () => {
    panel({ "fixture-a": { hasDraft: true, dueDate: "2026-10-14", latest: { number: 1, placements: [entry] } } });
    expect(screen.getByText("Draft in progress · due Oct 14")).toBeInTheDocument();
  });

  it("a fixture never published says so, and still offers the editor", () => {
    panel({});
    expect(screen.getByText("No planogram yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit planogram" })).toBeInTheDocument();
  });

  it("a mannequin holds no product, so no planogram link", () => {
    panel({}, "man");
    expect(screen.queryByRole("link", { name: "Edit planogram" })).not.toBeInTheDocument();
    expect(screen.queryByText("No planogram yet")).not.toBeInTheDocument();
  });

  it("another fixture opens with no product sheet or face carried over", async () => {
    const two: Layout = {
      ...layout,
      fixtures: [fixture({ zoneId: "zone-a" }), fixture({ id: "fixture-b", name: "Table 2", zoneId: "zone-a" })],
      faces: [face(), face({ id: "face-b", fixtureId: "fixture-b" })],
    };
    const planograms: Record<string, FloorPlanogram> = {
      "fixture-a": { hasDraft: false, dueDate: null, latest: { number: 1, placements: [entry] } },
      "fixture-b": { hasDraft: false, dueDate: null, latest: { number: 1, placements: [{ ...entry, faceId: "face-b", fixtureId: "fixture-b", fixtureName: "Table 2" }] } },
    };
    const view = (fixtureId: string) => <FixturePanel layout={two} fixtureId={fixtureId} planograms={planograms} looks={looks} />;
    const { rerender } = render(view("fixture-a"));
    await userEvent.click(screen.getByRole("button", { name: /Pocket Tee/ }));
    expect(screen.getByRole("complementary", { name: "Pocket Tee" })).toBeInTheDocument();
    rerender(view("fixture-b"));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

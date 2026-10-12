import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedVersion } from "@/lib/planograms/queries";
import type { DraftState, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

const hook = vi.hoisted(() => ({ draft: null as DraftState | null, save: (() => {}) as (...args: unknown[]) => unknown }));
vi.mock("./use-planogram-draft", async (original) => ({
  ...(await original<typeof import("./use-planogram-draft")>()),
  usePlanogramDraft: () => ({ draft: hook.draft, status: { kind: "idle" }, save: (...args: unknown[]) => hook.save(...args) }),
}));
vi.mock("@/app/(app)/planograms/actions", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import { PlanogramScreen } from "./planogram-screen";

const face = (faceId: string, label: string): PlanogramFace => ({ faceId, fixtureId: "r", fixtureName: "Rack 1", side: "front", setSide: null, label, columns: 4, rows: 3 });
const front = face("00000000-0000-4000-8000-000000000001", "Front");
const back = face("00000000-0000-4000-8000-000000000002", "Back");
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front, back] };
const cells = { col: 0, row: 0, colSpan: 2, rowSpan: 1, presentation: "folded" as const, pieceCount: 4 };
const pant: PlacementView = { ...cells, id: "d1", faceId: front.faceId, productId: "pant", productName: "Pant", styleNumber: "P-1", stackLimit: 8, version: 1, imageKey: null, categoryName: "Denim" };
const published: PublishedVersion = {
  number: 1,
  publishedAt: new Date("2026-10-08T12:00:00Z"),
  publishedByName: "Van",
  summary: null,
  placements: [{ ...cells, faceId: front.faceId, faceLabel: "Front", side: "front", fixtureId: "r", fixtureName: "Rack 1", productId: "pant", productName: "Pant", styleNumber: "P-1" }],
};

function screenWith(latest: PublishedVersion | null, draft: DraftState | null) {
  hook.draft = draft;
  return <PlanogramScreen scope={scope} row={null} latest={latest} draft={draft} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-10-11" />;
}

const tile = () => screen.getByRole("button", { name: /^Pant, / });

describe("PlanogramScreen", () => {
  beforeEach(() => {
    hook.draft = null;
    hook.save = vi.fn();
  });

  it("after Remove, focus moves to the planogram, not the top of the page", async () => {
    hook.save = vi.fn().mockResolvedValue({ saved: true });
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.getByRole("region", { name: /Rack 1, Front/ })).toHaveFocus());
  });

  it("closes the sheet when Draft | Published switches, instead of leaving it open and empty", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    expect(screen.getByRole("complementary", { name: "Pant" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Published" }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("closes a read-only sheet whose product is gone after a refresh", async () => {
    const user = userEvent.setup();
    const { rerender } = render(screenWith(published, null));
    await user.click(tile());
    expect(screen.getByRole("complementary", { name: "Pant" })).toBeInTheDocument();
    rerender(screenWith({ ...published, placements: [] }, null));
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("keeps the editor open to say a placement was removed on another device", async () => {
    const user = userEvent.setup();
    const { rerender } = render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    rerender(screenWith(published, { planogramVersion: 4, placements: [] }));
    expect(screen.getByText("Removed on another device")).toBeInTheDocument();
  });

  it("a sideways swipe on the grid shows the next face", () => {
    render(screenWith(published, null));
    const surface = screen.getByRole("region", { name: /, Front:/ }).firstElementChild!;
    fireEvent.touchStart(surface, { touches: [{ clientX: 300, clientY: 10 }] });
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [{ clientX: 200, clientY: 12 }] });
    expect(screen.getByRole("button", { name: "Back" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: /, Back:/ })).toBeInTheDocument();
  });

  it("says when there is no planogram yet", () => {
    render(screenWith(null, null));
    expect(screen.getByText("No planogram yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start draft" })).toBeInTheDocument();
  });
});

// The Published view marks sold-out tiles; the monthly draft view and a past version never do (0.7.0.9 spec §5.2).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PublishedVersion } from "@/lib/planograms/queries";
import type { DraftState, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

const hook = vi.hoisted(() => ({ draft: null as DraftState | null }));
vi.mock("./use-planogram-draft", async (original) => ({
  ...(await original<typeof import("./use-planogram-draft")>()),
  usePlanogramDraft: () => ({ draft: hook.draft, status: { kind: "idle" }, save: vi.fn(), adopt: vi.fn() }),
}));
vi.mock("@/app/(app)/planograms/actions", () => ({ pickerSearch: () => Promise.resolve([]), beginDraftAction: () => Promise.resolve(null) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { PlanogramScreen } from "./planogram-screen";

const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 4, rows: 3 };
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front] };
const cells = { col: 0, row: 0, colSpan: 2, rowSpan: 1, presentation: "folded" as const, pieceCount: 4 };
const version = (number: number): PublishedVersion => ({
  number, publishedAt: new Date("2026-10-08T12:00:00Z"), publishedByName: "Van", summary: null,
  placements: [{ ...cells, faceId: front.faceId, faceLabel: "Front", side: "front", fixtureId: "r", fixtureName: "Rack 1", productId: "pant", productName: "Pant", styleNumber: "P-1" }],
});
const pant: PlacementView = { ...cells, id: "d1", faceId: front.faceId, productId: "pant", productName: "Pant", styleNumber: "P-1", version: 1, depth: 0, imageKey: null, categoryName: "Denim" };
const looks = { pant: { imageKey: null, categoryName: "Denim", status: "sold_out" as const } };

const show = (draft: DraftState | null, viewing: PublishedVersion | null = null) => {
  hook.draft = draft;
  return render(<PlanogramScreen member={EVERYTHING} scope={scope} row={null} latest={version(2)} draft={draft} viewing={viewing} looks={looks} highlightProductId={null} dueDate={null} today="2026-10-11" />);
};

describe("PlanogramScreen status marks", () => {
  it("marks a sold-out tile on the Published view", () => {
    show(null);
    expect(screen.getByRole("button", { name: /^Pant, sold out, / })).toHaveAttribute("data-status", "sold_out");
  });

  it("does not on the monthly draft, even with the same product sold out, nor on a past version", async () => {
    const { unmount } = show({ planogramVersion: 3, placements: [pant] });
    expect(screen.getByRole("button", { name: /^Pant, (?!sold out)/ })).not.toHaveAttribute("data-status");
    await userEvent.click(screen.getByRole("button", { name: "Published" }));
    expect(screen.getByRole("button", { name: /^Pant, sold out, / })).toBeInTheDocument(); // the Published view of the same page
    unmount();
    show(null, version(1));
    expect(screen.getByRole("button", { name: /^Pant, (?!sold out)/ })).not.toHaveAttribute("data-status");
  });
});

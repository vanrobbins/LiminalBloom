// What a planogram screen shows for each set of switches (spec 0.7 §4.7). Hiding is a
// courtesy; the server refuses the same actions. Split from planogram-screen.test.tsx,
// which is already long.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/planograms/actions", () => ({
  pickerSearch: async () => [],
  beginDraftAction: async () => null,
  reloadDraftAction: async () => null,
  saveChangeAction: async () => null,
  startDraftAction: async () => null,
  discardDraftAction: async () => null,
  setDueDateAction: async () => null,
  previewPublishAction: async () => null,
  publishAction: async () => null,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import type { Switch } from "@/lib/access/switches";
import type { PublishedVersion } from "@/lib/planograms/queries";
import type { DraftState, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

import { PlanogramScreen } from "./planogram-screen";

const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 4, rows: 3 };
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front] };
const cells = { col: 0, row: 0, colSpan: 2, rowSpan: 1, presentation: "folded" as const, pieceCount: 4 };
const pant: PlacementView = { ...cells, id: "d1", faceId: front.faceId, productId: "pant", productName: "Pant", styleNumber: "P-1", version: 1, depth: 0, imageKey: null, categoryName: "Denim" };
const published: PublishedVersion = {
  number: 1,
  publishedAt: new Date("2026-10-08T12:00:00Z"),
  publishedByName: "Van",
  summary: null,
  placements: [{ ...cells, faceId: front.faceId, faceLabel: "Front", side: "front", fixtureId: "r", fixtureName: "Rack 1", productId: "pant", productName: "Pant", styleNumber: "P-1" }],
};
const draft: DraftState = { planogramVersion: 3, placements: [pant] };

const show = (switches: Switch[], over: { latest?: PublishedVersion | null; draft?: DraftState | null; dueDate?: string | null } = {}) =>
  render(
    <PlanogramScreen
      member={{ switches }}
      scope={scope}
      row={null}
      latest={over.latest === undefined ? published : over.latest}
      draft={over.draft === undefined ? null : over.draft}
      viewing={null}
      looks={{}}
      highlightProductId={null}
      dueDate={over.dueDate ?? null}
      today="2026-10-11"
    />,
  );

describe("PlanogramScreen controls by switch", () => {
  it("a viewer sees the published planogram and no draft, publish or due date controls", () => {
    show(["view"], { draft });
    expect(screen.getByRole("region", { name: /Rack 1, Front/ })).toBeInTheDocument();
    for (const name of ["Start draft", "Add product", "Publish…", "More draft actions", "Set due date", "Draft"]) {
      expect(screen.queryByRole("button", { name }), name).toBeNull();
    }
  });

  it("a viewer still sees a due date that is set, as plain text", () => {
    show(["view"], { dueDate: "2026-10-14" });
    expect(screen.getByText("Due Oct 14")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Due Oct 14" })).toBeNull();
  });

  it("a drafter can start a draft, but has no Set due date", () => {
    show(["view", "planograms.draft"]);
    expect(screen.getByRole("button", { name: "Start draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set due date" })).toBeNull();
  });

  it("a drafter in a draft gets Add product and the draft menu, but not Publish", () => {
    show(["view", "planograms.draft"], { draft });
    expect(screen.getByRole("button", { name: "Add product" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More draft actions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish…" })).toBeNull();
  });

  it("a publisher gets Publish and the due date, but cannot start a draft", () => {
    show(["view", "planograms.publish"]);
    expect(screen.getByRole("button", { name: "Set due date" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start draft" })).toBeNull();
  });

  it("with both, the draft shows Publish", () => {
    show(["view", "planograms.draft", "planograms.publish"], { draft });
    expect(screen.getByRole("button", { name: "Publish…" })).toBeInTheDocument();
  });

  it("with no planogram yet, a viewer is told so without being offered a draft", () => {
    show(["view"], { latest: null });
    expect(screen.getByText("No planogram yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start draft" })).toBeNull();
    expect(screen.queryByText(/A draft starts from/)).toBeNull();
  });
});

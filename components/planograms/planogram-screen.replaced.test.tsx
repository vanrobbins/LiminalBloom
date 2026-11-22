// A tile a published Quick Adjust put on the floor is not in the monthly version a draft starts from, so it can't be
// moved from the Published view: the move would start a draft and then fail to find the tile in it ("Changed on
// another device"). Tiles the adjustment left alone move as before.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedVersion } from "@/lib/planograms/queries";
import type { PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

vi.mock("./use-planogram-draft", async (original) => ({
  ...(await original<typeof import("./use-planogram-draft")>()),
  usePlanogramDraft: () => ({ draft: null, status: { kind: "idle" }, save: vi.fn(), adopt: vi.fn(), leave: vi.fn(), refuse: vi.fn(), note: vi.fn() }),
}));
const actions = vi.hoisted(() => ({ pickerSearch: vi.fn(), beginDraftAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { PlanogramScreen } from "./planogram-screen";

const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 8, rows: 6 };
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front] };
const entry = (productId: string, productName: string, row: number) => ({
  col: 0, row, colSpan: 2, rowSpan: 1, presentation: "folded" as const, pieceCount: 4, depth: 0,
  faceId: front.faceId, faceLabel: "Front", side: "front" as const, fixtureId: "r", fixtureName: "Rack 1", productId, productName, styleNumber: productId,
});
// The floor: a Slim jean where a Straight jean was (row 0, replaced by the adjustment), and an untouched Tee.
const floor: PublishedVersion = { number: 3, publishedAt: new Date("2026-10-08T12:00:00Z"), publishedByName: "Van", summary: null, placements: [entry("slim", "Slim jean", 0), entry("tee", "Tee", 3)] };
const replaced = new Set([`${front.faceId}|0|0|0`]);

describe("PlanogramScreen with a published Quick Adjust", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.beginDraftAction.mockResolvedValue({ status: "refused", message: "stop", draft: null });
  });

  async function nudge(name: RegExp) {
    const user = userEvent.setup();
    render(<PlanogramScreen member={EVERYTHING} scope={scope} row={null} latest={floor} draft={null} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-10-11" replacedSpots={replaced} />);
    await user.click(screen.getByRole("button", { name }));
    await user.keyboard("{ArrowRight}");
  }

  it("a tile the adjustment left alone moves: the first move starts a draft", async () => {
    await nudge(/^Tee, /);
    await waitFor(() => expect(actions.beginDraftAction).toHaveBeenCalledTimes(1));
  });

  it("a replaced tile is not lifted and no draft is started: it opens its panel but can't be moved from here", async () => {
    await nudge(/^Slim jean, /);
    expect(screen.getByRole("button", { name: /^Slim jean, / })).not.toHaveAttribute("data-lifted");
    expect(actions.beginDraftAction).not.toHaveBeenCalled();
  });
});

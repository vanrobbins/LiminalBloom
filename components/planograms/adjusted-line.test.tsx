import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdjustmentState, Adjustments } from "@/lib/planograms/adjust";
import { diffPlacements } from "@/lib/planograms/diff";
import { emptying, entry, FACE, replacing } from "@/lib/planograms/test-adjust";
import type { PlanogramScope } from "@/lib/planograms/types";

import { AdjustmentLines } from "./adjusted-line";

const actions = vi.hoisted(() => ({ revertAdjustmentAction: vi.fn(), previewAdjustmentAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/adjust-actions", () => actions);
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/toast", () => ({ toast }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const scope: PlanogramScope = { fixtureId: "fx", fixtureName: "Wall bay 3", isSet: false, faces: [FACE] };
const straight = entry({ productId: "straight", productName: "Straight jean" });
const version = { number: 3, placements: [straight] };
const looks = { straight: { imageKey: null, categoryName: "Jeans", status: "sold_out" as const } };
const state = (over: Partial<AdjustmentState> = {}): AdjustmentState => ({
  id: "adj",
  planogramId: "p",
  state: "published",
  basedOnVersion: 3,
  version: 2,
  createdByName: "Sam",
  createdAt: new Date("2026-11-17T12:00:00Z"),
  publishedAt: new Date("2026-11-17T12:00:00Z"),
  publishedByName: "Van",
  changes: [{ ...replacing(straight, "slim"), id: "c", version: 1 }],
  ...over,
});
const none: Adjustments = { draft: null, published: null };
const lines = (adjustments: Adjustments, ...switches: string[]) =>
  render(<AdjustmentLines fixtureId="fx" scope={scope} adjustments={adjustments} version={version} looks={looks} member={{ switches: ["view", ...switches] } as never} />);

describe("AdjustmentLines", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows nothing with no adjustment", () => {
    const { container } = lines(none, "planograms.draft", "planograms.publish");
    expect(container).toBeEmptyDOMElement();
  });

  it("says who published it and when, and gives everyone Compare but only drafters Edit and publishers Revert", () => {
    lines({ draft: null, published: state() });
    const line = screen.getByText(/Quick Adjust · since/).closest("[data-adjustment]") as HTMLElement;
    expect(line).toHaveTextContent(/since Nov 17, .+ · Van/);
    expect(within(line).getByRole("button", { name: "Compare Quick Adjust" })).toBeInTheDocument();
    expect(within(line).queryByRole("link", { name: "Edit Quick Adjust" })).toBeNull();
    expect(within(line).queryByRole("button", { name: "Revert Quick Adjust" })).toBeNull();
  });

  it("Edit needs planograms.draft and goes to the adjust page; Revert needs planograms.publish", () => {
    const { unmount } = lines({ draft: null, published: state() }, "planograms.draft");
    expect(screen.getByRole("link", { name: "Edit Quick Adjust" })).toHaveAttribute("href", "/planograms/fx/adjust");
    expect(screen.queryByRole("button", { name: "Revert Quick Adjust" })).toBeNull();
    unmount();
    lines({ draft: null, published: state() }, "planograms.publish");
    expect(screen.getByRole("button", { name: "Revert Quick Adjust" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit Quick Adjust" })).toBeNull();
  });

  it("Revert asks first, says what goes back, then reverts and toasts", async () => {
    actions.revertAdjustmentAction.mockResolvedValue({ status: "saved", message: "Quick Adjust reverted" });
    lines({ draft: null, published: state() }, "planograms.publish");
    await userEvent.click(screen.getByRole("button", { name: "Revert Quick Adjust" }));
    const dialog = screen.getByRole("dialog", { name: "Put Version 3 back on the floor?" });
    expect(dialog).toHaveTextContent("Straight jean goes back on Wall bay 3, though it is sold out.");
    expect(actions.revertAdjustmentAction).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Revert" }));
    expect(actions.revertAdjustmentAction).toHaveBeenCalledWith("fx", "adj");
    expect(toast).toHaveBeenCalledWith({ tone: "success", title: "Quick Adjust reverted" });
    expect(refresh).toHaveBeenCalled();
  });

  it("a refused revert says why in an error toast", async () => {
    actions.revertAdjustmentAction.mockResolvedValue({ status: "refused", message: "This Quick Adjust is no longer on the floor." });
    lines({ draft: null, published: state() }, "planograms.publish");
    await userEvent.click(screen.getByRole("button", { name: "Revert Quick Adjust" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Revert" }));
    expect(toast).toHaveBeenCalledWith({ tone: "error", title: "This Quick Adjust is no longer on the floor." });
  });

  it("Compare opens the real Compare for the published adjustment: the words, then the two figures", async () => {
    actions.previewAdjustmentAction.mockResolvedValue({
      kind: "published", adjustmentId: "adj", version: 2, basedOnVersion: 3, changes: diffPlacements([straight], []), before: [straight], after: [], looks: {}, soldOutAfter: [],
    });
    lines({ draft: null, published: state({ changes: [{ ...emptying(straight), id: "c", version: 1 }] }) });
    await userEvent.click(screen.getByRole("button", { name: "Compare Quick Adjust" }));
    expect(await screen.findByText("Wall bay 3 · Front: Straight jean → left empty")).toBeInTheDocument();
    expect(screen.getAllByRole("figure").map((f) => f.querySelector("figcaption")?.textContent)).toEqual(["Before · Version 3", "After · Quick Adjust"]);
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
  });

  it("a draft waiting shows who and when, with Open for drafters; a publisher without the switch just sees it", () => {
    const draft = state({ state: "draft", createdByName: "Sam" });
    const { unmount } = lines({ draft, published: null }, "planograms.draft");
    expect(document.querySelector("[data-adjustment=draft]")).toHaveTextContent(/Quick Adjust draft · Sam · Nov 17/);
    expect(screen.getByRole("link", { name: "Open Quick Adjust draft" })).toHaveAttribute("href", "/planograms/fx/adjust");
    unmount();
    lines({ draft, published: null }, "planograms.publish");
    expect(screen.getByText(/Quick Adjust draft · Sam/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open Quick Adjust draft/ })).toBeNull();
  });

  it("a viewer who can neither draft nor publish does not see a draft", () => {
    const { container } = lines({ draft: state({ state: "draft" }), published: null });
    expect(container).toBeEmptyDOMElement();
  });
});

// Compare (0.7.0.9 spec §5.3): the words first, then Before and After as figures, stacked until 1024 px; the publish
// confirm only when it is asked for and there is a draft to publish; refusals stay in the dialog and the preview reloads.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdjustPreview } from "@/lib/planograms/adjust-reads";
import { diffPlacements } from "@/lib/planograms/diff";
import { entry, FACE } from "@/lib/planograms/test-adjust";
import type { PlanogramScope } from "@/lib/planograms/types";

const actions = vi.hoisted(() => ({ previewAdjustmentAction: vi.fn(), publishAdjustmentAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/adjust-actions", () => actions);
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/toast", () => ({ toast }));
const media = vi.hoisted(() => ({ phone: false }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => media.phone }));

import { AdjustCompare } from "./adjust-compare";

const scope: PlanogramScope = { fixtureId: "fx", fixtureName: "Wall bay 3", isSet: false, faces: [FACE] };
const straight = entry({ productId: "straight", productName: "Straight jean" });
const slim = { ...straight, productId: "slim", productName: "Slim jean" };
const preview = (over: Partial<AdjustPreview> = {}): AdjustPreview => ({
  kind: "draft", adjustmentId: "adj", version: 4, basedOnVersion: 3, changes: diffPlacements([straight], [slim]), before: [straight], after: [slim],
  looks: { straight: { imageKey: null, categoryName: "Jeans" }, slim: { imageKey: null, categoryName: "Jeans" } }, soldOutAfter: [], ...over,
});

function show(props: Partial<React.ComponentProps<typeof AdjustCompare>> = {}) {
  const onOpenChange = vi.fn();
  const onPublished = vi.fn();
  const view = render(<AdjustCompare fixtureId="fx" which="draft" scope={scope} open onOpenChange={onOpenChange} onPublished={onPublished} {...props} />);
  return { onOpenChange, onPublished, ...view };
}

beforeEach(() => {
  vi.resetAllMocks();
  media.phone = false;
  actions.previewAdjustmentAction.mockResolvedValue(preview());
});

describe("AdjustCompare", () => {
  it("lists what changes in words before anything else: the face's summary and each tile's two products", async () => {
    show();
    const words = await screen.findByText("Wall bay 3 · Front: Straight jean → Slim jean");
    expect(screen.getByText(/^Front: 1 added, 1 removed/)).toBeInTheDocument();
    expect(words.compareDocumentPosition(screen.getAllByRole("figure")[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws Before and After as figures with captions, the tile that changes outlined in both", async () => {
    show();
    const figures = await screen.findAllByRole("figure");
    expect(figures.map((f) => f.querySelector("figcaption")?.textContent)).toEqual(["Before · Version 3", "After"]);
    expect(within(figures[0]).getByRole("button", { name: /^Straight jean, will change/ })).toHaveAttribute("data-status", "changed");
    expect(within(figures[1]).getByRole("button", { name: /^Slim jean, replaces Straight jean/ })).toHaveAttribute("data-status", "replaced");
  });

  it("asks for the kind it was given, so the published line never reads a draft", async () => {
    show({ which: "published" });
    await screen.findAllByRole("figure");
    expect(actions.previewAdjustmentAction).toHaveBeenCalledWith("fx", "published");
  });

  it("stacks Before above After and goes side by side from 1024 px (lg), not 768 (md)", async () => {
    show();
    await screen.findAllByRole("figure");
    const grids = document.querySelector("[data-compare-grids]") as HTMLElement;
    expect(grids).toHaveClass("lg:grid-cols-2");
    expect(grids.className).not.toMatch(/\bmd:grid-cols-2\b/);
    expect(grids.className).not.toMatch(/(^|\s)grid-cols-2\b/);
  });

  it("has no Publish button when it only looks", async () => {
    show();
    await screen.findAllByRole("figure");
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
  });

  it("with Publish asked for, publishes the draft it read, says so in a toast, closes and hands over", async () => {
    actions.publishAdjustmentAction.mockResolvedValue({ status: "saved", message: "Quick Adjust published" });
    const { onOpenChange, onPublished } = show({ publishing: true });
    await userEvent.click(await screen.findByRole("button", { name: "Publish to this store" }));
    expect(actions.publishAdjustmentAction).toHaveBeenCalledWith("fx", "adj", 4);
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith({ tone: "success", title: "Quick Adjust published" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("warns about a product still sold out on the floor, only where it is publishing", async () => {
    actions.previewAdjustmentAction.mockResolvedValue(preview({ soldOutAfter: ["Bootcut"] }));
    const { unmount } = show({ publishing: true });
    expect(await screen.findByText("Bootcut is sold out and is still on the floor.")).toBeInTheDocument();
    unmount();
    show();
    await screen.findAllByRole("figure");
    expect(screen.queryByText(/is sold out and is still on the floor/)).toBeNull();
  });

  it("a refusal stays in the dialog, and the preview is read again", async () => {
    actions.publishAdjustmentAction.mockResolvedValue({ status: "refused", message: "Changed on another device. Look again before publishing." });
    const { onPublished } = show({ publishing: true });
    await userEvent.click(await screen.findByRole("button", { name: "Publish to this store" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Changed on another device. Look again before publishing.");
    await waitFor(() => expect(actions.previewAdjustmentAction).toHaveBeenCalledTimes(2));
    expect(onPublished).not.toHaveBeenCalled();
  });

  it("offers no Publish for the published adjustment, nor for a draft with no change in it", async () => {
    actions.previewAdjustmentAction.mockResolvedValue(preview({ kind: "published" }));
    const { unmount } = show({ publishing: true });
    expect(await screen.findByText("There is no draft to publish.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish to/ })).toBeNull();
    unmount();
    actions.previewAdjustmentAction.mockResolvedValue(preview({ changes: [], before: [straight], after: [straight] }));
    show({ publishing: true });
    expect(await screen.findByText("Nothing to publish yet.")).toBeInTheDocument();
  });

  it("says so when there is no Quick Adjust left to compare", async () => {
    actions.previewAdjustmentAction.mockResolvedValue(null);
    show();
    expect(await screen.findByText(/no Quick Adjust to compare/)).toBeInTheDocument();
  });

  it("on a phone it is a sheet with the same content", async () => {
    media.phone = true;
    show();
    expect(await screen.findByText("Wall bay 3 · Front: Straight jean → Slim jean")).toBeInTheDocument();
    expect(screen.getAllByRole("figure")).toHaveLength(2);
  });
});

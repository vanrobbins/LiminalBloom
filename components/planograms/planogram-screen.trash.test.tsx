// The planogram screen's trash disc and keys (0.7.0.5 task 5): a removal that
// lands late leaves the person's new selection and focus alone; keys typed in the
// panel don't remove. Split from planogram-screen.corner.test.tsx.

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedVersion } from "@/lib/planograms/queries";
import type { DraftState, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

const hook = vi.hoisted(() => ({ draft: null as DraftState | null, save: (() => {}) as (...args: unknown[]) => unknown, leave: (() => {}) as () => void }));
vi.mock("./use-planogram-draft", async (original) => ({
  ...(await original<typeof import("./use-planogram-draft")>()),
  usePlanogramDraft: () => ({ draft: hook.draft, status: { kind: "idle" }, save: (pending: unknown) => hook.save(typeof pending === "function" ? pending(hook.draft) : pending), adopt: (next: DraftState) => (hook.draft = next), leave: hook.leave }),
}));
const actions = vi.hoisted(() => ({
  pickerSearch: vi.fn(),
  beginDraftAction: vi.fn(),
  startDraftAction: vi.fn(),
}));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { PlanogramScreen } from "./planogram-screen";

const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 4, rows: 3 };
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front] };
const cells = { col: 0, row: 0, colSpan: 2, rowSpan: 1, presentation: "folded" as const, pieceCount: 4 };
const pant: PlacementView = { ...cells, id: "d1", faceId: front.faceId, productId: "pant", productName: "Pant", styleNumber: "P-1", version: 1, depth: 0, imageKey: null, categoryName: "Denim" };
const tee: PlacementView = { ...pant, id: "d2", productId: "tee", productName: "Tee", styleNumber: "T-1", col: 2 };
const published: PublishedVersion = {
  number: 1,
  publishedAt: new Date("2026-10-08T12:00:00Z"),
  publishedByName: "Van",
  summary: null,
  placements: [{ ...cells, faceId: front.faceId, faceLabel: "Front", side: "front", fixtureId: "r", fixtureName: "Rack 1", productId: "pant", productName: "Pant", styleNumber: "P-1" }],
};

function screenWith(latest: PublishedVersion | null, draft: DraftState | null) {
  hook.draft = draft;
  return <PlanogramScreen member={EVERYTHING} scope={scope} row={null} latest={latest} draft={draft} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-10-11" />;
}

const button = (name: string) => screen.queryByRole("button", { name });

describe("PlanogramScreen trash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hook.draft = null;
    hook.leave = vi.fn();
  });

  // The fade and the server round trip leave time to pick another tile: a save that lands then is the old tile's.
  it("a removal that lands after another tile was selected leaves that tile selected and focused", async () => {
    let answer: (result: unknown) => void = () => {};
    hook.save = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant, tee] }));
    await user.click(screen.getByRole("button", { name: /^Pant, / }));
    await user.click(screen.getByRole("button", { name: "Remove Pant" }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /^Tee, / }));
    await act(async () => answer({ saved: true, draft: { planogramVersion: 4, placements: [tee] } }));
    await act(async () => void (await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))));
    expect(button("Remove Tee")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Tee, / })).toHaveFocus();
  });

  // Space, like Enter, is a keyboard click: it opens the panel on the selected tile (spec §2.3).
  it("Space on the selected tile opens its panel, as Enter does", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(screen.getByRole("button", { name: /^Pant, / }));
    screen.getByRole("button", { name: /^Pant, / }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("complementary", { name: "Pant" })).toBeInTheDocument();
  });

  it.each(["Delete", "Backspace"])("%s in the open panel's number field does not remove the tile", async (key) => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(screen.getByRole("button", { name: /^Pant, / }));
    await user.click(screen.getByRole("button", { name: "Edit Pant" }));
    await user.click(screen.getByLabelText("From left (ft)"));
    await user.keyboard(`{${key}}`);
    expect(hook.save).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "remove" }));
    expect(screen.getByRole("button", { name: /^Pant, / })).not.toHaveAttribute("data-leaving");
  });

  // Escape during the fade deselects; when the removal lands, focus goes to the grid, not the page.
  it("a removal that lands after Escape deselected sends focus to the grid", async () => {
    let answer: (result: unknown) => void = () => {};
    hook.save = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant, tee] }));
    await user.click(screen.getByRole("button", { name: /^Pant, / }));
    await user.click(screen.getByRole("button", { name: "Remove Pant" }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    screen.getByRole("button", { name: /^Pant, / }).focus();
    await user.keyboard("{Escape}");
    await act(async () => answer({ saved: true, draft: { planogramVersion: 4, placements: [tee] } }));
    await act(async () => void (await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))));
    expect(document.querySelector("[data-planogram-grid]")).toHaveFocus();
  });
});

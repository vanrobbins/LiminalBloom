import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedVersion } from "@/lib/planograms/queries";
import type { DraftState, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

const hook = vi.hoisted(() => ({ draft: null as DraftState | null, save: (() => {}) as (...args: unknown[]) => unknown }));
vi.mock("./use-planogram-draft", async (original) => ({
  ...(await original<typeof import("./use-planogram-draft")>()),
  usePlanogramDraft: () => ({ draft: hook.draft, status: { kind: "idle" }, save: (pending: unknown) => hook.save(typeof pending === "function" ? pending(hook.draft) : pending), adopt: (next: DraftState) => (hook.draft = next) }),
}));
const actions = vi.hoisted(() => ({
  pickerSearch: (() => Promise.resolve([])) as (q: string) => Promise<unknown[]>,
  beginDraftAction: (() => Promise.resolve(null)) as (...args: unknown[]) => Promise<unknown>,
}));
vi.mock("@/app/(app)/planograms/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { PlanogramScreen } from "./planogram-screen";

const face = (faceId: string, label: string): PlanogramFace => ({ faceId, fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label, columns: 4, rows: 3 });
const front = face("00000000-0000-4000-8000-000000000001", "Front");
const back = face("00000000-0000-4000-8000-000000000002", "Back");
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front, back] };
const cells = { col: 0, row: 0, colSpan: 2, rowSpan: 1, presentation: "folded" as const, pieceCount: 4 };
const pant: PlacementView = { ...cells, id: "d1", faceId: front.faceId, productId: "pant", productName: "Pant", styleNumber: "P-1", version: 1, depth: 0, imageKey: null, categoryName: "Denim" };
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

const tile = () => screen.getByRole("button", { name: /^Pant, / });
const tee: PlacementView = { ...pant, id: "d2", productId: "tee", productName: "Tee", styleNumber: "T-1", col: 2 };
describe("PlanogramScreen", () => {
  beforeEach(() => {
    hook.draft = null;
    hook.save = vi.fn();
  });

  it("after Remove, focus moves to the planogram, not the top of the page", async () => {
    hook.save = vi.fn().mockResolvedValue({ saved: true, draft: { planogramVersion: 4, placements: [] } });
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Remove Pant" }));
    await waitFor(() => expect(screen.getByRole("region", { name: /Rack 1, Front/ })).toHaveFocus());
  });

  it("when Remove is refused, focus goes back to the tile, which is still there (B8)", async () => {
    hook.save = vi.fn().mockResolvedValue({ saved: false, message: "Changed on another device" });
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Remove Pant" }));
    await waitFor(() => expect(tile()).toHaveFocus());
  });

  it("closes the sheet when Draft | Published switches, instead of leaving it open and empty", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Edit Pant" }));
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
    await user.click(screen.getByRole("button", { name: "Edit Pant" }));
    rerender(screenWith(published, { planogramVersion: 4, placements: [] }));
    expect(screen.getByText("Removed on another device")).toBeInTheDocument();
  });

  it("in a draft, a tap selects the tile and shows its corner discs, without the sheet; the pencil opens it", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    expect(screen.getByRole("button", { name: "Remove Pant" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Pant" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Edit Pant" }));
    expect(screen.getByRole("complementary", { name: "Pant" })).toBeInTheDocument();
    expect(screen.getByLabelText("From left (ft)")).toBeInTheDocument();
  });

  it("another tap on the selected tile opens the same panel; the first tap only selects", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    expect(screen.queryByRole("complementary", { name: "Pant" })).toBeNull();
    await user.click(tile());
    expect(screen.getByRole("complementary", { name: "Pant" })).toBeInTheDocument();
    expect(screen.getByLabelText("From left (ft)")).toBeInTheDocument();
  });

  it("Enter on the selected tile opens its panel with focus in the form; Delete removes it with no dialog", async () => {
    hook.save = vi.fn().mockResolvedValue({ saved: true, draft: { planogramVersion: 4, placements: [] } });
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant, tee] }));
    await user.click(tile());
    tile().focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByLabelText("From left (ft)")).toHaveFocus());
    tile().focus();
    await user.keyboard("{Delete}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(hook.save).toHaveBeenCalledWith({ kind: "remove", id: "d1", version: 1 }));
  });

  it("closing Edit numbers clears the selection, so a phone gets Publish back", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Edit Pant" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("button", { name: "Remove Pant" })).not.toBeInTheDocument();
  });
});

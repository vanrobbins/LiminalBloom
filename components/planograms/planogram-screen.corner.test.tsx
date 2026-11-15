// The planogram screen with the corner bar (0.7.0.5 task 4): + starts a draft
// when there is none, Undo and Redo are icons in the status row, and the draft
// bar, the phone's sticky bar and Start draft are gone. Split from
// planogram-screen.test.tsx, which is already long.

import { render, screen, waitFor, within } from "@testing-library/react";
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
const teeFit = { id: "tee", name: "Tee", styleNumber: "T-1", footprints: { folded: { columns: 2, rows: 1 }, hung: { columns: 2, rows: 1 } } };
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

describe("PlanogramScreen corner bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hook.draft = null;
    hook.save = vi.fn();
    hook.leave = vi.fn();
    actions.pickerSearch.mockResolvedValue([teeFit]);
  });

  it("the bar is in the status row, with Undo, Redo, Add and, on a draft, Publish and ⋯", () => {
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    const row = screen.getByRole("button", { name: "Undo" }).closest("[data-status-row]") as HTMLElement;
    for (const name of ["Redo", "Add product", "Publish…", "More draft actions"]) expect(within(row).getByRole("button", { name }), name).toBeInTheDocument();
  });

  it("on the published version with no draft there is no Start draft: just +, which starts one", () => {
    render(screenWith(published, null));
    expect(button("Start draft")).toBeNull();
    expect(button("Add product")).not.toBeNull();
    for (const name of ["Undo", "Redo", "Publish…", "More draft actions"]) expect(button(name), name).toBeNull();
  });

  it("with no draft, Add product starts one and places the product clear of what's already on the floor", async () => {
    const started: DraftState = { planogramVersion: 3, placements: [pant] };
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: started });
    hook.save = vi.fn(() => {
      hook.draft = { planogramVersion: 4, placements: [pant, tee] };
      return Promise.resolve({ saved: true, id: "d2", draft: hook.draft });
    });
    const user = userEvent.setup();
    render(screenWith(published, null));
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    expect(actions.beginDraftAction).toHaveBeenCalledTimes(1);
    // The pant holds cells 0–2 of the published version: the tee goes beside it, not on it.
    expect(hook.save).toHaveBeenCalledWith({ kind: "add", productId: "tee", fields: expect.objectContaining({ faceId: front.faceId, col: 2, row: 0 }) });
  });

  it("a refused start says why in the Add dialog and saves nothing", async () => {
    actions.beginDraftAction.mockResolvedValue({ status: "refused", message: "Published again on another device.", draft: null });
    const user = userEvent.setup();
    render(screenWith(published, null));
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Published again on another device.");
    expect(hook.save).not.toHaveBeenCalled();
    // This screen is out of date: it reloads, as a refused first move does.
    expect(hook.leave).toHaveBeenCalledTimes(1);
  });

  it("Undo and Redo are disabled until a move gives them something to do, then act", async () => {
    const moved = { ...pant, col: 1, version: 2 };
    hook.save = vi.fn().mockResolvedValue({ saved: true, draft: { planogramVersion: 4, placements: [moved] }, before: pant });
    const user = userEvent.setup();
    const { rerender } = render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    expect(button("Undo")).toBeDisabled();
    expect(button("Redo")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^Pant, / }));
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(button("Undo")).toBeEnabled());
    rerender(screenWith(published, { planogramVersion: 4, placements: [moved] }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(hook.save).toHaveBeenLastCalledWith({ kind: "update", id: "d1", version: 2, fields: expect.objectContaining({ col: 0 }) });
    await waitFor(() => expect(button("Redo")).toBeEnabled());
    expect(button("Undo")).toBeDisabled();
  });

  it("no sticky action bar and no phone spacer under the grid", () => {
    const { container } = render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    expect(container.querySelector("[data-action-bar]")).toBeNull();
    expect(container.querySelector(".h-16")).toBeNull();
  });

  it("the empty box keeps one labelled Start planogram, which starts the draft and reloads", async () => {
    actions.startDraftAction.mockResolvedValue({ status: "saved", message: "" });
    const user = userEvent.setup();
    render(screenWith(null, null));
    const box = screen.getByText("No planogram yet").closest("[data-empty]") as HTMLElement;
    await user.click(within(box).getByRole("button", { name: "Start planogram" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(actions.startDraftAction).toHaveBeenCalledWith("r", null);
  });
});

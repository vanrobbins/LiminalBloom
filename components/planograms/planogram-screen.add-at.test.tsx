// Tap empty space to add, on the whole screen (0.7.0.5 task 7, spec §2.2): the tap opens Add product, the pick goes
// to the tapped cell when it is allowed there and to the first open spot otherwise, with the status line saying
// so; read-only screens do nothing. The grid's own tap rules are planogram-grid.tap.test.tsx.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedVersion } from "@/lib/planograms/queries";
import type { DraftState, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

const hook = vi.hoisted(() => ({
  draft: null as DraftState | null,
  save: (() => {}) as (...args: unknown[]) => unknown,
  leave: (() => {}) as () => void,
  note: (() => {}) as (message: string) => void,
}));
vi.mock("./use-planogram-draft", async (original) => ({
  ...(await original<typeof import("./use-planogram-draft")>()),
  usePlanogramDraft: () => ({
    draft: hook.draft,
    status: { kind: "idle" },
    save: (pending: unknown) => hook.save(typeof pending === "function" ? pending(hook.draft) : pending),
    adopt: (next: DraftState) => (hook.draft = next),
    leave: hook.leave,
    note: (message: string) => hook.note(message),
  }),
}));
const actions = vi.hoisted(() => ({ pickerSearch: vi.fn(), beginDraftAction: vi.fn(), startDraftAction: vi.fn() }));
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
const tee: PlacementView = { ...pant, id: "d2", productId: "tee", productName: "Tee", styleNumber: "T-1", col: 2, row: 1 };
const teeFit = { id: "tee", name: "Tee", styleNumber: "T-1", footprints: { folded: { columns: 2, rows: 1 }, hung: { columns: 2, rows: 1 } } };
const published: PublishedVersion = {
  number: 1,
  publishedAt: new Date("2026-10-08T12:00:00Z"),
  publishedByName: "Van",
  summary: null,
  placements: [{ ...cells, faceId: front.faceId, faceLabel: "Front", side: "front", fixtureId: "r", fixtureName: "Rack 1", productId: "pant", productName: "Pant", styleNumber: "P-1" }],
};
const draftOf = (...placements: PlacementView[]): DraftState => ({ planogramVersion: 3, placements });

function screenWith(latest: PublishedVersion | null, draft: DraftState | null, member = EVERYTHING) {
  hook.draft = draft;
  return <PlanogramScreen member={member} scope={scope} row={null} latest={latest} draft={draft} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-10-11" />;
}

// 4 units across, drawn 80 px wide: 20 px a unit, a row is 40 px. Column 2 / row 1 is (50, 50); column 3 / row 2 is (70, 90).
const sized = () =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 80, bottom: 120, width: 80, height: 120, toJSON: () => ({}) } as DOMRect);
const block = () => document.querySelector<HTMLElement>("[data-block]")!;
function tapAt(x: number, y: number) {
  fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: x, clientY: y });
  fireEvent.pointerUp(block(), { pointerType: "mouse", clientX: x, clientY: y });
  fireEvent.click(block(), { clientX: x, clientY: y });
}
const saveOk = (placements: PlacementView[], id: string) => {
  hook.save = vi.fn(() => {
    hook.draft = { planogramVersion: 4, placements };
    return Promise.resolve({ saved: true, id, draft: hook.draft });
  });
};

describe("PlanogramScreen tap empty to add", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hook.draft = null;
    hook.save = vi.fn();
    hook.leave = vi.fn();
    hook.note = vi.fn();
    actions.pickerSearch.mockResolvedValue([teeFit]);
    sized();
  });
  afterEach(() => vi.restoreAllMocks());

  it("a tap on an empty cell opens Add product, and the pick goes at that cell with no note", async () => {
    saveOk([pant, tee], "d2");
    const user = userEvent.setup();
    render(screenWith(published, draftOf(pant)));
    tapAt(50, 50);
    expect(await screen.findByRole("dialog", { name: "Add product" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    expect(hook.save).toHaveBeenCalledWith({ kind: "add", productId: "tee", fields: expect.objectContaining({ faceId: front.faceId, col: 2, row: 1 }) });
    expect(hook.note).not.toHaveBeenCalled();
  });

  it("where it cannot go (off the edge) it goes to the first open spot and the status line says so", async () => {
    saveOk([pant, { ...tee, row: 0 }], "d2");
    const user = userEvent.setup();
    render(screenWith(published, draftOf(pant)));
    // Column 3 is the last: the tee is two wide.
    tapAt(70, 90);
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    expect(hook.save).toHaveBeenCalledWith({ kind: "add", productId: "tee", fields: expect.objectContaining({ col: 2, row: 0 }) });
    await waitFor(() => expect(hook.note).toHaveBeenCalledWith("Placed at the nearest open spot"));
  });

  it("where its size would run into another product it goes to the first open spot too", async () => {
    const belt: PlacementView = { ...pant, id: "d3", productId: "belt", productName: "Belt", styleNumber: "B-1", col: 2, row: 1 };
    saveOk([pant, belt, { ...tee, row: 0 }], "d2");
    const user = userEvent.setup();
    render(screenWith(published, draftOf(pant, belt)));
    // Column 1, row 1 is open, but the tee is two wide and the belt starts at column 2.
    tapAt(30, 50);
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    expect(hook.save).toHaveBeenCalledWith({ kind: "add", productId: "tee", fields: expect.objectContaining({ col: 2, row: 0 }) });
    await waitFor(() => expect(hook.note).toHaveBeenCalledWith("Placed at the nearest open spot"));
  });

  it("with no draft the tap starts one, and the cell is judged against the draft that comes back", async () => {
    const belt: PlacementView = { ...pant, id: "d3", productId: "belt", productName: "Belt", styleNumber: "B-1", col: 2, row: 1 };
    actions.beginDraftAction.mockResolvedValue({ status: "saved", draft: draftOf(pant, belt) });
    saveOk([pant, belt, { ...tee, row: 0 }], "d2");
    const user = userEvent.setup();
    render(screenWith(published, null));
    tapAt(50, 50);
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    expect(actions.beginDraftAction).toHaveBeenCalledTimes(1);
    // The belt sits on the tapped cell in that draft: the tee falls back to the first open spot.
    expect(hook.save).toHaveBeenCalledWith({ kind: "add", productId: "tee", fields: expect.objectContaining({ col: 2, row: 0 }) });
    await waitFor(() => expect(hook.note).toHaveBeenCalledWith("Placed at the nearest open spot"));
  });

  it("with a tile selected a tap on empty space only deselects", async () => {
    const user = userEvent.setup();
    render(screenWith(published, draftOf(pant)));
    await user.click(screen.getByRole("button", { name: /^Pant, / }));
    expect(screen.getByRole("button", { name: /^Pant, / })).toHaveAttribute("aria-pressed", "true");
    tapAt(50, 50);
    expect(screen.getByRole("button", { name: /^Pant, / })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("dialog", { name: "Add product" })).toBeNull();
  });

  it("the end of a pan does not open Add", () => {
    render(screenWith(published, draftOf(pant)));
    fireEvent.pointerDown(block(), { pointerType: "mouse", button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(block(), { pointerType: "mouse", clientX: 10, clientY: 50 });
    fireEvent.click(block(), { clientX: 10, clientY: 50 });
    expect(screen.queryByRole("dialog", { name: "Add product" })).toBeNull();
  });

  it("without the draft switch, tapping empty space does nothing", () => {
    render(screenWith(published, null, { switches: ["view"] }));
    tapAt(50, 50);
    expect(screen.queryByRole("dialog", { name: "Add product" })).toBeNull();
    expect(actions.beginDraftAction).not.toHaveBeenCalled();
  });

  it("Enter on the focused grid opens Add, and the pick goes to the first open spot with no note", async () => {
    saveOk([pant, { ...tee, row: 0 }], "d2");
    const user = userEvent.setup();
    render(screenWith(published, draftOf(pant)));
    const grid = document.querySelector<HTMLElement>("[data-planogram-grid]")!;
    grid.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    expect(hook.save).toHaveBeenCalledWith({ kind: "add", productId: "tee", fields: expect.objectContaining({ col: 2, row: 0 }) });
    expect(hook.note).not.toHaveBeenCalled();
  });

  it("a tap after a cancelled Add does not carry the old cell into the next Add from +", async () => {
    saveOk([pant, { ...tee, row: 0 }], "d2");
    const user = userEvent.setup();
    render(screenWith(published, draftOf(pant)));
    tapAt(50, 90);
    await screen.findByRole("dialog", { name: "Add product" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add product" })).toBeNull());
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    // From +, the first open spot, not the cell tapped before.
    expect(hook.save).toHaveBeenCalledWith({ kind: "add", productId: "tee", fields: expect.objectContaining({ col: 2, row: 0 }) });
  });
});

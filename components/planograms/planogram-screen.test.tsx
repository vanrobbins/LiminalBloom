import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

import { PlanogramScreen } from "./planogram-screen";

const face = (faceId: string, label: string): PlanogramFace => ({ faceId, fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label, columns: 4, rows: 3 });
const front = face("00000000-0000-4000-8000-000000000001", "Front");
const back = face("00000000-0000-4000-8000-000000000002", "Back");
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front, back] };
const cells = { col: 0, row: 0, colSpan: 2, rowSpan: 1, presentation: "folded" as const, pieceCount: 4 };
const pant: PlacementView = { ...cells, id: "d1", faceId: front.faceId, productId: "pant", productName: "Pant", styleNumber: "P-1", version: 1, imageKey: null, categoryName: "Denim" };
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
const tee: PlacementView = { ...pant, id: "d2", productId: "tee", productName: "Tee", styleNumber: "T-1", col: 2 };
const teeFit = { id: "tee", name: "Tee", styleNumber: "T-1", footprints: { folded: { columns: 2, rows: 1 }, hung: { columns: 2, rows: 1 } } };

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
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.getByRole("region", { name: /Rack 1, Front/ })).toHaveFocus());
  });

  it("closes the sheet when Draft | Published switches, instead of leaving it open and empty", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Details" }));
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
    await user.click(screen.getByRole("button", { name: "Edit numbers" }));
    rerender(screenWith(published, { planogramVersion: 4, placements: [] }));
    expect(screen.getByText("Removed on another device")).toBeInTheDocument();
  });

  it("in a draft, a tap selects the tile without the sheet; Details opens it", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    expect(screen.getByRole("toolbar", { name: "Pant selected" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Pant" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("complementary", { name: "Pant" })).toBeInTheDocument();
    expect(screen.queryByLabelText("From left (ft)")).toBeNull();
  });

  it("closing Edit numbers clears the selection, so a phone gets Publish back", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Edit numbers" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("toolbar", { name: "Pant selected" })).not.toBeInTheDocument();
  });

  it("Edit numbers opens the form in feet", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Edit numbers" }));
    expect(screen.getByLabelText("From left (ft)")).toHaveValue("0");
  });

  it("Escape on the selected tile deselects it", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("toolbar", { name: "Pant selected" })).toBeNull();
  });

  it("Ctrl+Z undoes a move in the draft, but not while Published is shown", async () => {
    const moved = { ...pant, col: 1, version: 2 };
    hook.save = vi.fn().mockResolvedValue({ saved: true, draft: { planogramVersion: 4, placements: [moved] } });
    const user = userEvent.setup();
    const { rerender } = render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    rerender(screenWith(published, { planogramVersion: 4, placements: [moved] }));
    await user.click(screen.getByRole("button", { name: "Published" }));
    // fireEvent returns false when the key was taken (preventDefault).
    expect(fireEvent.keyDown(window, { key: "z", ctrlKey: true })).toBe(true);
    expect(hook.save).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Draft" }));
    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(2));
    expect(hook.save).toHaveBeenLastCalledWith({ kind: "update", id: "d1", version: 2, fields: expect.objectContaining({ col: 0 }) });
  });

  it("the open panel follows the selection, in the same mode", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant, tee] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: /^Tee, / }));
    expect(screen.getByRole("complementary", { name: "Tee" })).toBeInTheDocument();
    expect(screen.queryByLabelText("From left (ft)")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Edit numbers" }));
    await user.click(tile());
    expect(screen.getByRole("complementary", { name: "Pant" })).toBeInTheDocument();
    expect(screen.getByLabelText("From left (ft)")).toHaveValue("0");
  });

  it("Escape on the selected tile, or a tap on empty space, closes the panel", async () => {
    const user = userEvent.setup();
    const { container } = render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Details" }));
    tile().focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).toBeNull();
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(container.querySelector<HTMLElement>("[data-block]")!);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("Edit numbers moves focus to the form's first field", async () => {
    const user = userEvent.setup();
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(tile());
    await user.click(screen.getByRole("button", { name: "Edit numbers" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Side" })).toHaveFocus());
  });

  it("Add product places, selects and focuses the new tile, and says where", async () => {
    actions.pickerSearch = vi.fn().mockResolvedValue([teeFit]);
    hook.save = vi.fn().mockResolvedValue({ saved: true, draft: { planogramVersion: 4, placements: [pant, tee] } });
    const user = userEvent.setup();
    const { rerender } = render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.type(screen.getByLabelText("Find a product"), "Tee");
    hook.draft = { planogramVersion: 4, placements: [pant, tee] };
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    rerender(screenWith(published, { planogramVersion: 4, placements: [pant, tee] }));
    expect(hook.save).toHaveBeenCalledWith({ kind: "add", productId: "tee", fields: expect.objectContaining({ faceId: front.faceId, col: 2, row: 0 }) });
    await waitFor(() => expect(screen.getByRole("button", { name: /^Tee, / })).toHaveFocus());
    expect(screen.getByRole("toolbar", { name: "Tee selected" })).toBeInTheDocument();
    expect(screen.getByText(/^Added Tee at /)).toBeInTheDocument();
  });

  it("on a past version, Ctrl+Z is left to the browser", () => {
    hook.draft = { planogramVersion: 3, placements: [pant] };
    render(<PlanogramScreen scope={scope} row={null} latest={published} draft={hook.draft} viewing={published} looks={{}} highlightProductId={null} dueDate={null} today="2026-10-11" />);
    expect(fireEvent.keyDown(window, { key: "z", ctrlKey: true })).toBe(true);
    expect(hook.save).not.toHaveBeenCalled();
  });

  it("with no draft, a tap opens the sheet as before", async () => {
    const user = userEvent.setup();
    render(screenWith(published, null));
    await user.click(tile());
    expect(screen.getByRole("complementary", { name: "Pant" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).toBeNull();
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

  it("on Published, an arrow that starts a draft keeps the tile selected and focused, so the next arrow works", async () => {
    const started = { planogramVersion: 3, placements: [pant] };
    const moved = { planogramVersion: 4, placements: [{ ...pant, col: 1, version: 2 }] };
    actions.beginDraftAction = vi.fn().mockResolvedValue({ status: "saved", draft: started });
    hook.save = vi.fn(() => {
      hook.draft = moved;
      return Promise.resolve({ saved: true, draft: moved });
    });
    const user = userEvent.setup();
    render(screenWith(published, null));
    await user.click(tile());
    expect(tile()).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(tile()).toHaveFocus());
    expect(tile()).toHaveAttribute("data-placement", "d1");
    expect(screen.getByRole("toolbar", { name: "Pant selected" })).toBeInTheDocument();
  });
});

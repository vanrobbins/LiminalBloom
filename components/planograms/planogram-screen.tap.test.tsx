import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
describe("PlanogramScreen", () => {
  beforeEach(() => {
    hook.draft = null;
    hook.save = vi.fn();
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
    expect(screen.getByRole("button", { name: "Start planogram" })).toBeInTheDocument();
  });

  it("with nothing yet, Start planogram sits in the empty box, said once, and no due date is offered", () => {
    render(screenWith(null, null));
    const box = screen.getByText("No planogram yet").closest("[data-empty]") as HTMLElement;
    expect(within(box).getByRole("button", { name: "Start planogram" })).toBeInTheDocument();
    expect(screen.getAllByText(/what.s on the floor now/)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Set due date" })).toBeNull();
  });

  it("puts Draft | Published (which says the version in its tooltip, not beside it) and Publish on one row", () => {
    render(screenWith(published, { planogramVersion: 3, placements: [pant] }));
    const row = screen.getByRole("button", { name: "Publish" }).closest("[data-status-row]") as HTMLElement;
    expect(row).not.toBeNull();
    expect(within(row).queryByText(/Version 1 · published/)).toBeNull();
    expect(within(row).getByRole("button", { name: "Published" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Remove Pant" })).toBeInTheDocument();
  });

  it("after a draft starts, focus isn't pulled back to the tile if it moved elsewhere meanwhile (B10)", async () => {
    const started = { planogramVersion: 3, placements: [pant] };
    const moved = { planogramVersion: 4, placements: [{ ...pant, col: 1, version: 2 }] };
    actions.beginDraftAction = vi.fn().mockResolvedValue({ status: "saved", draft: started });
    let settle: () => void = () => {};
    hook.save = vi.fn(
      () =>
        new Promise((resolve) => {
          settle = () => {
            hook.draft = moved;
            resolve({ saved: true, draft: moved });
          };
        }),
    );
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Elsewhere</button>
        {screenWith(published, null)}
      </>,
    );
    await user.click(tile());
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(hook.save).toHaveBeenCalledTimes(1));
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    await act(async () => settle());
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(elsewhere).toHaveFocus();
  });
});

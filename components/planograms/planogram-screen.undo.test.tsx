// Undo across the real draft queue against a small fake server (0.7.0.5 task 2):
// a trashed tile comes back from the server with everything it had, an add is
// undone and redone under a new id that later steps follow, and the history
// clears when the draft is published, discarded or gone.

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Change, DraftState, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

type Server = { version: number; rows: PlacementView[]; next: number };
const fake = vi.hoisted(() => ({ server: { version: 1, rows: [], next: 0 } as Server }));
const draftOf = (): DraftState => ({ planogramVersion: fake.server.version, placements: structuredClone(fake.server.rows) });
const actions = vi.hoisted(() => ({
  saveChangeAction: vi.fn(), reloadDraftAction: vi.fn(), beginDraftAction: vi.fn(), pickerSearch: vi.fn(),
  previewPublishAction: vi.fn(), publishAction: vi.fn(), discardDraftAction: vi.fn(), startDraftAction: vi.fn(),
}));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn(() => 1), dismissToast: vi.fn() }));
vi.mock("@/components/shell/shell-context", () => ({ useActiveStoreName: () => "Store" }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { PlanogramScreen } from "./planogram-screen";

const face = (faceId: string, label: string): PlanogramFace => ({ faceId, fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label, columns: 8, rows: 3 });
const front = face("00000000-0000-4000-8000-000000000001", "Front");
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front] };
const pant: PlacementView = {
  id: "d1", faceId: front.faceId, productId: "pant", productName: "Pant", styleNumber: "P-1", presentation: "hung",
  col: 1, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 7, depth: 1, version: 3, imageKey: null, categoryName: "Denim",
};
const teeFit = { id: "tee", name: "Tee", styleNumber: "T-1", footprints: { folded: { columns: 2, rows: 1 }, hung: { columns: 2, rows: 1 } } };

/** What the server does with a change: version-checked, a new id for an add. */
function serve(change: Change) {
  const { server } = fake;
  if (change.kind === "add") {
    const id = `n${++server.next}`;
    const name = change.productId === "tee" ? "Tee" : "Pant";
    server.rows.push({ ...pant, ...change.fields, id, productId: change.productId, productName: name, depth: change.fields.depth ?? 0, version: 1 });
  } else {
    const row = server.rows.find((r) => r.id === change.id);
    if (!row || row.version !== change.version) return { status: "refused", message: "Changed on another device", draft: draftOf() };
    if (change.kind === "remove") server.rows = server.rows.filter((r) => r !== row);
    else Object.assign(row, change.fields, { version: row.version + 1 });
  }
  server.version += 1;
  return { status: "saved", draft: draftOf() };
}

type User = ReturnType<typeof userEvent.setup>;
const tile = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}, `) });
const gone = (name: string) => waitFor(() => expect(screen.queryByRole("button", { name: new RegExp(`^${name}, `) })).toBeNull());
const back = (name: string) => waitFor(() => expect(tile(name)).toBeInTheDocument());
const undoKey = (user: User) => user.keyboard("{Control>}z{/Control}");
const redoKey = (user: User) => user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
const lastChange = () => actions.saveChangeAction.mock.lastCall?.[1];

function show() {
  return render(
    <PlanogramScreen member={EVERYTHING} scope={scope} row={null} latest={null} draft={draftOf()} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-11-15" />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.server = { version: 1, rows: [structuredClone(pant)], next: 0 };
  actions.saveChangeAction.mockImplementation((_fixture: string, change: Change) => Promise.resolve(serve(change)));
  actions.reloadDraftAction.mockImplementation(() => Promise.resolve(draftOf()));
  actions.pickerSearch.mockResolvedValue([teeFit]);
});

describe("Undo and Redo of a removed or added placement", () => {
  it("a trashed tile comes back from the server with its face, cells, presentation, pieces and layer; Redo removes it again", async () => {
    const user = userEvent.setup();
    show();
    await user.click(tile("Pant"));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await gone("Pant");
    expect(lastChange()).toEqual({ kind: "remove", id: "d1", version: 3 });

    await undoKey(user);
    await back("Pant");
    expect(lastChange()).toEqual({
      kind: "add",
      productId: "pant",
      fields: { faceId: front.faceId, presentation: "hung", col: 1, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 7, depth: 1 },
    });
    expect(fake.server.rows).toHaveLength(1);
    expect(fake.server.rows[0]).toMatchObject({ id: "n1", pieceCount: 7, depth: 1, presentation: "hung" });

    await redoKey(user);
    await gone("Pant");
    // Redo removes the restored placement under the id the server gave it.
    expect(lastChange()).toEqual({ kind: "remove", id: "n1", version: 1 });
  });

  it("an add is undone, redone under a new id, and later steps follow that id", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.type(screen.getByLabelText("Find a product"), "Tee");
    await user.click(await screen.findByRole("button", { name: /Tee/ }));
    await waitFor(() => expect(tile("Tee")).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(actions.saveChangeAction).toHaveBeenCalledTimes(2));
    expect(lastChange()).toMatchObject({ kind: "update", id: "n1", fields: expect.objectContaining({ col: 4 }) });

    await undoKey(user); // the move
    await waitFor(() => expect(actions.saveChangeAction).toHaveBeenCalledTimes(3));
    await undoKey(user); // the add
    await gone("Tee");
    expect(lastChange()).toEqual({ kind: "remove", id: "n1", version: 3 });

    await redoKey(user); // the add, again: a new id
    await back("Tee");
    expect(lastChange()).toMatchObject({ kind: "add", productId: "tee" });
    expect(fake.server.rows.map((r) => r.id)).toContain("n2");

    await redoKey(user); // the move follows the placement
    await waitFor(() => expect(actions.saveChangeAction).toHaveBeenCalledTimes(6));
    expect(lastChange()).toMatchObject({ kind: "update", id: "n2", version: 1, fields: expect.objectContaining({ col: 4 }) });
  });

  it("a refused restore drops the step, says why on the status line, and leaves nothing to replay", async () => {
    const user = userEvent.setup();
    show();
    await user.click(tile("Pant"));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await gone("Pant");
    actions.saveChangeAction.mockResolvedValueOnce({ status: "refused", message: "That spot is taken.", draft: draftOf() });
    await undoKey(user);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("That spot is taken."));
    const sent = actions.saveChangeAction.mock.calls.length;
    await undoKey(user);
    await redoKey(user);
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(sent);
  });
});

describe("the history clears", () => {
  async function withOneStep() {
    const user = userEvent.setup();
    show();
    await user.click(tile("Pant"));
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(actions.saveChangeAction).toHaveBeenCalledTimes(1));
    return user;
  }
  const settled = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

  it("after publish", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 2, basedOnVersion: null, nextNumber: 1, changes: [], issues: [], isEmpty: false });
    actions.publishAction.mockResolvedValue({ status: "saved", message: "Published" });
    const user = await withOneStep();
    await user.click(screen.getByRole("button", { name: "Publish…" }));
    await user.click(await screen.findByRole("button", { name: /^Publish to / }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await undoKey(user);
    await settled();
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
  });

  it("after discard", async () => {
    actions.discardDraftAction.mockResolvedValue({ status: "saved", message: "Draft discarded" });
    const user = await withOneStep();
    await user.click(screen.getByRole("button", { name: "More draft actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Discard draft…" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Discard this draft?" })).getByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await undoKey(user);
    await settled();
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
  });

  it("after a Changed on another device refresh", async () => {
    const user = await withOneStep();
    actions.reloadDraftAction.mockResolvedValue(null);
    fireEvent.focus(window);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    await undoKey(user);
    await settled();
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
  });
});

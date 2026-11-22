// The one product panel on the real draft queue against a small fake server (0.7.0.5 task 6): numbers that save as
// they change (one debounced save is one Undo step; a pending one is sent into the tile it was typed for when the
// panel closes or another tile is picked), the face picker that replaces Move to face, and Forward / Back.

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Change, DraftState, PlacementView, PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

type Server = { version: number; rows: PlacementView[] };
const fake = vi.hoisted(() => ({ server: { version: 1, rows: [] } as Server }));
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
const back = face("00000000-0000-4000-8000-000000000002", "Back");
const twoFaces: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front, back] };
const oneFace: PlanogramScope = { ...twoFaces, faces: [front] };
const row = (id: string, name: string, over: Partial<PlacementView> = {}): PlacementView => ({
  id, faceId: front.faceId, productId: `p-${id}`, productName: name, styleNumber: id, presentation: "folded",
  col: 0, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 7, depth: 0, version: 3, imageKey: null, categoryName: "Denim", ...over,
});
const pant = () => row("d1", "Pant");
const tee = () => row("d2", "Tee", { col: 3, pieceCount: 4 });

/** The server's save: version-checked. */
function serve(change: Change) {
  const { server } = fake;
  const found = change.kind === "add" ? undefined : server.rows.find((r) => r.id === change.id);
  if (change.kind !== "add" && (!found || found.version !== change.version)) return { status: "refused", message: "Changed on another device", draft: draftOf() };
  if (change.kind === "update" && found) Object.assign(found, change.fields, { version: found.version + 1 });
  server.version += 1;
  return { status: "saved", draft: draftOf() };
}

const tile = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}, `) });
const saves = () => actions.saveChangeAction.mock.calls.map((c) => c[1] as Change);
const pieces = () => screen.getByLabelText("Pieces");
const sent = (n: number) => waitFor(() => expect(actions.saveChangeAction).toHaveBeenCalledTimes(n));
/** A moment far short of the 600 ms pause: a save that has gone by now was sent by the close or the new pick, not by the timer. */
const briefly = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)));

function show(scope = oneFace) {
  return render(<PlanogramScreen member={EVERYTHING} scope={scope} row={null} latest={null} draft={draftOf()} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-11-16" />);
}

/** Selects a tile and opens its panel with the pencil. */
async function openPanel(user: ReturnType<typeof userEvent.setup>, name: string) {
  // fireEvent: a tile sharing rail space is painted through, which a pointer can't click.
  fireEvent.click(tile(name));
  await user.click(screen.getByRole("button", { name: `Edit ${name}` }));
  await screen.findByLabelText("Pieces");
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.server = { version: 1, rows: [pant(), tee()] };
  actions.saveChangeAction.mockImplementation((_fixture: string, change: Change) => Promise.resolve(serve(change)));
  actions.reloadDraftAction.mockImplementation(() => Promise.resolve(draftOf()));
});

describe("the panel's numbers save as they change", () => {
  it("has no Save button and no Move to face; a text edit is sent after the pause, not before", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: /move to face/i })).toBeNull();
    fireEvent.change(pieces(), { target: { value: "9" } });
    expect(actions.saveChangeAction).not.toHaveBeenCalled();
    await sent(1);
    expect(saves()[0]).toMatchObject({ kind: "update", id: "d1", version: 3, fields: expect.objectContaining({ pieceCount: 9 }) });
    expect(await within(screen.getByRole("complementary", { name: "Pant" })).findByText("Saved")).toBeInTheDocument();
  });

  it("an invalid value stays in the field with its message, and nothing is sent", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(pieces(), { target: { value: "100" } });
    expect(await screen.findByText("At most 99 pieces")).toBeInTheDocument();
    expect(pieces()).toHaveValue("100");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(actions.saveChangeAction).not.toHaveBeenCalled();
  });

  it("two edits inside one pause are one save and one Undo step; Undo puts the numbers back, in the field too", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(pieces(), { target: { value: "5" } });
    fireEvent.change(pieces(), { target: { value: "6" } });
    await sent(1);
    expect(saves()[0]).toMatchObject({ fields: expect.objectContaining({ pieceCount: 6 }) });
    await waitFor(() => expect(fake.server.rows[0].version).toBe(4));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await sent(2);
    expect(saves()[1]).toMatchObject({ kind: "update", id: "d1", fields: expect.objectContaining({ pieceCount: 7 }) });
    await waitFor(() => expect(pieces()).toHaveValue("7"));
    // One step: a second Undo has nothing left (the button is aria-disabled).
    expect(screen.getByRole("button", { name: "Undo" })).toHaveAttribute("aria-disabled", "true");
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(2);
  });

  it("a refusal shows under the fields and in the panel's own line, not as a toast", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    actions.saveChangeAction.mockResolvedValueOnce({ status: "refused", message: "Changed on another device", draft: draftOf() });
    fireEvent.change(pieces(), { target: { value: "5" } });
    const panel = screen.getByRole("complementary", { name: "Pant" });
    expect(await within(panel).findByText("Changed on another device")).toBeVisible();
    expect(await within(panel).findByText("Couldn't save")).toBeInTheDocument();
  });

  it("sends a pending edit when the panel closes", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(pieces(), { target: { value: "5" } });
    // fireEvent: no blur first, so only the close can send it.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await briefly();
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
    expect(saves()[0]).toMatchObject({ kind: "update", id: "d1", fields: expect.objectContaining({ pieceCount: 5 }) });
    expect(screen.queryByRole("complementary")).toBeNull();
    // Saving after the close doesn't re-select the tile.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("button", { name: "Remove Pant" })).toBeNull();
  });

  it("sends a pending edit when another tile is picked, into the tile it was typed for, not the new one", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(pieces(), { target: { value: "5" } });
    fireEvent.click(tile("Tee"));
    await briefly();
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
    expect(saves()[0]).toMatchObject({ kind: "update", id: "d1", fields: expect.objectContaining({ pieceCount: 5 }) });
    expect(screen.getByRole("complementary", { name: "Tee" })).toBeInTheDocument();
    expect(pieces()).toHaveValue("4");
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
    expect(fake.server.rows.find((r) => r.id === "d2")).toMatchObject({ pieceCount: 4, version: 3 });
    expect(fake.server.rows.find((r) => r.id === "d1")).toMatchObject({ pieceCount: 5 });
  });
});

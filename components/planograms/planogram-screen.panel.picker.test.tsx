// The one product panel on the real draft queue against a small fake server (0.7.0.5 task 6): numbers that save as
// they change (one debounced save is one Undo step; a pending one is sent into the tile it was typed for when the
// panel closes or another tile is picked), the face picker that replaces Move to face, and Forward / Back.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const sent = (n: number) => waitFor(() => expect(actions.saveChangeAction).toHaveBeenCalledTimes(n));
/** A moment far short of the 600 ms pause: a save that has gone by now was sent by the close or the new pick, not by the timer. */
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

describe("the face picker", () => {
  it("is hidden when the planogram has one face", async () => {
    const user = userEvent.setup();
    show(oneFace);
    await openPanel(user, "Pant");
    expect(screen.queryByRole("group", { name: "Face" })).toBeNull();
  });

  it("moves the tile to the first open spot on the face picked, and the view follows it", async () => {
    fake.server.rows = [pant(), tee(), row("d3", "Sock", { faceId: back.faceId, col: 0, colSpan: 3 })];
    const user = userEvent.setup();
    show(twoFaces);
    await openPanel(user, "Pant");
    await user.click(within(screen.getByRole("group", { name: "Face" })).getByRole("button", { name: "Back" }));
    await sent(1);
    // Sock fills columns 0-3 of the back: the first open spot is right after it.
    expect(saves()[0]).toMatchObject({ kind: "update", id: "d1", fields: expect.objectContaining({ faceId: back.faceId, col: 3, row: 0 }) });
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Face" })).getByRole("button", { name: "Back" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says inline in the panel when nothing fits there, and sends nothing", async () => {
    fake.server.rows = [pant(), row("d3", "Rug", { faceId: back.faceId, col: 0, colSpan: 8, rowSpan: 3 })];
    const user = userEvent.setup();
    show(twoFaces);
    await openPanel(user, "Pant");
    await user.click(within(screen.getByRole("group", { name: "Face" })).getByRole("button", { name: "Back" }));
    const panel = screen.getByRole("complementary", { name: "Pant" });
    expect(await within(panel).findByRole("alert")).toHaveTextContent("No open spot fits on Back");
    expect(actions.saveChangeAction).not.toHaveBeenCalled();
  });
});

describe("Forward and Back", () => {
  const hung = (id: string, name: string, over: Partial<PlacementView> = {}) => row(id, name, { presentation: "hung", ...over });

  it("show in the panel when the tile shares rail space, and not when it has the rail to itself", async () => {
    fake.server.rows = [hung("d1", "Pant", { depth: 0 }), hung("d2", "Tee", { col: 1, depth: 1 }), hung("d3", "Cap", { col: 6, colSpan: 1 })];
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    const panel = screen.getByRole("complementary", { name: "Pant" });
    expect(within(panel).getByRole("button", { name: "Move forward" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Move back" })).toBeEnabled();
    fireEvent.click(tile("Cap"));
    expect(await screen.findByRole("complementary", { name: "Cap" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move forward" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move back" })).toBeNull();
  });
});

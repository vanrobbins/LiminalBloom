// The product panel's saves racing the things around them (0.7.0.5 task 6 review): a face picked while a typed edit
// is still on its way, a refusal that lands after the form is gone, and Undo or Redo with an edit still waiting.

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
const row = (id: string, name: string, over: Partial<PlacementView> = {}): PlacementView => ({
  id, faceId: front.faceId, productId: `p-${id}`, productName: name, styleNumber: id, presentation: "folded",
  col: 0, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 7, depth: 0, version: 3, imageKey: null, categoryName: "Denim", ...over,
});

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
const faceButton = (name: string) => within(screen.getByRole("group", { name: "Face" })).getByRole("button", { name });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function show() {
  return render(<PlanogramScreen member={EVERYTHING} scope={twoFaces} row={null} latest={null} draft={draftOf()} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-11-16" />);
}

async function openPanel(user: ReturnType<typeof userEvent.setup>, name: string) {
  fireEvent.click(tile(name));
  await user.click(screen.getByRole("button", { name: `Edit ${name}` }));
  await screen.findByLabelText("Pieces");
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.server = { version: 1, rows: [row("d1", "Pant"), row("d2", "Tee", { col: 3, pieceCount: 4 })] };
  // A save takes a moment, as it does over a network: that is where the races are.
  actions.saveChangeAction.mockImplementation(async (_fixture: string, change: Change) => {
    await pause(20);
    return serve(change);
  });
  actions.reloadDraftAction.mockImplementation(() => Promise.resolve(draftOf()));
});

describe("a face picked while a typed edit is on its way", () => {
  it("keeps the typed numbers: the move is built on them, not on the numbers the panel opened with", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(pieces(), { target: { value: "5" } });
    await user.click(faceButton("Back"));
    await waitFor(() => expect(saves()).toHaveLength(2));
    expect(saves()[0]).toMatchObject({ fields: expect.objectContaining({ pieceCount: 5, faceId: front.faceId }) });
    expect(saves()[1]).toMatchObject({ kind: "update", id: "d1", fields: expect.objectContaining({ pieceCount: 5, faceId: back.faceId, col: 0, row: 0 }) });
    await waitFor(() => expect(fake.server.rows[0]).toMatchObject({ pieceCount: 5, faceId: back.faceId }));
  });

  it("with no blur first (a tap on a button that never takes focus), the pending edit is sent before the move", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(pieces(), { target: { value: "5" } });
    fireEvent.click(faceButton("Back"));
    await waitFor(() => expect(saves()).toHaveLength(2));
    expect(saves()[0]).toMatchObject({ fields: expect.objectContaining({ pieceCount: 5, faceId: front.faceId }) });
    expect(saves()[1]).toMatchObject({ fields: expect.objectContaining({ pieceCount: 5, faceId: back.faceId }) });
    await waitFor(() => expect(fake.server.rows[0]).toMatchObject({ pieceCount: 5, faceId: back.faceId }));
    await pause(700);
    expect(saves()).toHaveLength(2);
  });
});

describe("a refusal that lands after the form is gone", () => {
  it("is not lost: picking another tile while the edit is refused leaves the reason on the corner bar's status line", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    actions.saveChangeAction.mockImplementationOnce(async () => {
      await pause(20);
      return { status: "refused", message: "Blocked by Tee", draft: draftOf() };
    });
    fireEvent.change(pieces(), { target: { value: "5" } });
    fireEvent.click(tile("Tee"));
    // Well inside the 600 ms pause: it is the unmount that sent it, not the timer left running behind.
    await pause(100);
    expect(saves()).toHaveLength(1);
    expect(document.querySelector("[data-draft-refusal]")).toHaveTextContent("Blocked by Tee");
  });

  it("is not lost when the placement has left the draft by then (the edit goes out and the server refuses it)", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(pieces(), { target: { value: "5" } });
    // Another device removes it and this one hears: the panel turns to "Removed on another device" and the form goes.
    fake.server.rows = fake.server.rows.filter((r) => r.id !== "d1");
    fake.server.version += 1;
    window.dispatchEvent(new Event("focus"));
    await screen.findByText("Removed on another device");
    await waitFor(() => expect(document.querySelector("[data-draft-refusal]")).toHaveTextContent("Changed on another device"));
  });

  it("an invalid value left in the form when the panel closes is told on the status line, not dropped", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    const fromLeft = screen.getByLabelText("From left (ft)");
    fireEvent.change(fromLeft, { target: { value: "2.25" } });
    fireEvent.keyDown(fromLeft, { key: "Escape" });
    // Inside the 600 ms pause: it is the closing that says so, not the timer left running behind.
    await pause(100);
    expect(screen.queryByLabelText("Pieces")).toBeNull();
    expect(document.querySelector("[data-draft-refusal]")).toHaveTextContent("Use feet in half steps");
    expect(saves()).toHaveLength(0);
  });

  it("the same when another tile is picked", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(screen.getByLabelText("From left (ft)"), { target: { value: "2.25" } });
    fireEvent.click(tile("Tee"));
    await pause(100);
    expect(document.querySelector("[data-draft-refusal]")).toHaveTextContent("Use feet in half steps");
    expect(saves()).toHaveLength(0);
  });
});

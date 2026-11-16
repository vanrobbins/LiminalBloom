// Undo of layer changes across the real draft queue against a small fake server that settles depths as the
// real one does (DECISIONS 11-15): trashing a tile and bringing it back, and another device renumbering tiles.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { layersAfter } from "@/lib/planograms/layer-depths";
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
const toasts = vi.hoisted(() => ({ toast: vi.fn(() => 1), dismissToast: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);
vi.mock("@/components/shell/shell-context", () => ({ useActiveStoreName: () => "Store" }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { PlanogramScreen } from "./planogram-screen";

const face: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 8, rows: 3 };
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [face] };
const tileRow = (id: string, col: number, colSpan: number, depth: number): PlacementView => ({
  id, faceId: face.faceId, productId: `p-${id}`, productName: id.toUpperCase(), styleNumber: id, presentation: "hung",
  col, row: 0, colSpan, rowSpan: 1, pieceCount: 1, depth, version: 1, imageKey: null, categoryName: "Denim",
});
/** r0 in front of everything; r2 and r3 share column 0; r1 sits to the right of those (the task 2 re-review's rail). */
const start = () => [tileRow("r0", 0, 3, 0), tileRow("r2", 0, 1, 1), tileRow("r3", 0, 1, 2), tileRow("r1", 1, 3, 3)];

/** The server's save: version-checked, depths settled by the real `layersAfter`, a new id for an add. */
function serve(change: Change) {
  const { server } = fake;
  if (change.kind !== "add") {
    const row = server.rows.find((r) => r.id === change.id);
    if (!row || row.version !== change.version) return { status: "refused", message: "Changed on another device", draft: draftOf() };
  }
  const layers = layersAfter(server.rows, change);
  let added: string | undefined;
  server.rows = server.rows.map((r) => ({ ...r, depth: layers.others.find(([id]) => id === r.id)?.[1] ?? r.depth }));
  if (change.kind === "add") {
    added = `n${++server.next}`;
    const fields = { ...change.fields, place: undefined };
    server.rows.push({ ...tileRow(added, 0, 1, 0), ...fields, id: added, productId: change.productId, productName: change.productId.slice(2).toUpperCase(), depth: layers.depth });
  } else if (change.kind === "remove") server.rows = server.rows.filter((r) => r.id !== change.id);
  else {
    const fields = { ...change.fields, place: undefined };
    server.rows = server.rows.map((r) => (r.id === change.id ? { ...r, ...fields, depth: layers.depth, version: r.version + 1 } : r));
  }
  server.version += 1;
  return { status: "saved", draft: draftOf(), ...(added ? { id: added } : {}) };
}

type User = ReturnType<typeof userEvent.setup>;
const depths = () => Object.fromEntries(fake.server.rows.map((r) => [r.id, r.depth]));
const tile = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}, `) });
const gone = (name: string) => waitFor(() => expect(screen.queryByRole("button", { name: new RegExp(`^${name}, `) })).toBeNull());
const back = (name: string) => waitFor(() => expect(tile(name)).toBeInTheDocument());
const saves = (n: number) => waitFor(() => expect(actions.saveChangeAction).toHaveBeenCalledTimes(n));
const undoKey = (user: User) => user.keyboard("{Control>}z{/Control}");
// A refusal is told on the draft's status line, not in a toast.
const conflict = () => {
  expect(document.querySelector("[data-draft-refusal]")).toHaveTextContent("Changed on another device");
  expect(toasts.toast).not.toHaveBeenCalled();
};

function show() {
  return render(<PlanogramScreen member={EVERYTHING} scope={scope} row={null} latest={null} draft={draftOf()} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-11-15" />);
}

/** Select R3 and Move forward past R2: a step on R3 that records where it sits among the tiles it overlaps. */
async function moveR3Forward(user: User) {
  fireEvent.click(tile("R3"));
  tile("R3").focus();
  await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
  await saves(1);
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.server = { version: 1, rows: start(), next: 0 };
  actions.saveChangeAction.mockImplementation((_fixture: string, change: Change) => Promise.resolve(serve(change)));
  actions.reloadDraftAction.mockImplementation(() => Promise.resolve(draftOf()));
});

describe("Undo after trashing a tile on a shared rail", () => {
  it("trash the front tile, Undo, Undo again: the second Undo is not refused as changed on another device", async () => {
    const user = userEvent.setup();
    show();
    await moveR3Forward(user);
    expect(depths()).toMatchObject({ r0: 0, r3: 1, r2: 2, r1: 3 });

    fireEvent.click(tile("R0"));
    await user.click(screen.getByRole("button", { name: "Remove R0" }));
    await gone("R0");
    // Nothing renumbers when it goes: the two parts keep their numbers.
    expect(depths()).toMatchObject({ r3: 1, r2: 2, r1: 3 });

    await undoKey(user); // R0 comes back, in front, under a new id
    await back("R0");
    expect(depths()).toMatchObject({ r3: 1, r2: 2, r1: 3 });
    expect(fake.server.rows.find((r) => r.productId === "p-r0")?.depth).toBe(0);

    await undoKey(user); // the Move forward: this was refused before layer depths were stable
    await saves(4);
    expect(toasts.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Changed on another device" }));
    // Every tile is back where it started, front to back (gaps in the numbers are fine).
    const order = [...fake.server.rows].sort((a, b) => a.depth - b.depth).map((r) => r.productId.slice(2));
    expect(order).toEqual(["r0", "r2", "r3", "r1"]);
  });
});

describe("Undo after another device renumbers a tile", () => {
  it("their tile pushes this one back a number; the Undo of this device's step on it still works", async () => {
    const user = userEvent.setup();
    show();
    await moveR3Forward(user);
    // Another device adds a tile at the very front (it is not in this device's history): every tile behind moves back one.
    fake.server.rows = [...fake.server.rows.map((r) => ({ ...r, depth: r.depth + 1 })), tileRow("theirs", 0, 3, 0)];
    fake.server.version += 1;
    fireEvent.focus(window);
    await back("THEIRS");

    await undoKey(user);
    await saves(2);
    expect(toasts.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Changed on another device" }));
    const [r2, r3] = [depths().r2, depths().r3];
    expect(r2).toBeLessThan(r3);
  });

  it("but if the other device moved the tile itself, Undo says so and sends nothing", async () => {
    const user = userEvent.setup();
    show();
    await moveR3Forward(user);
    // Their Move back: R3 behind R2 again, at a new version.
    fake.server.rows = fake.server.rows.map((r) => (r.id === "r3" ? { ...r, depth: 2, version: r.version + 1 } : r.id === "r2" ? { ...r, depth: 1 } : r));
    fake.server.version += 1;
    fireEvent.focus(window);
    await waitFor(() => expect(tile("R3")).toHaveAttribute("data-rank", "2"));
    await undoKey(user);
    await waitFor(conflict);
    expect(actions.saveChangeAction).toHaveBeenCalledTimes(1);
  });
});

// What a screen reader hears for one typed panel edit (0.7.0.5 11b): the panel's own line says Saved, and the corner
// indicator and the builder's "Changed to …" stay quiet; a refusal is said once, on the draft's status line.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front] };
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
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function show() {
  return render(<PlanogramScreen member={EVERYTHING} scope={scope} row={null} latest={null} draft={draftOf()} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-11-16" />);
}

async function openPanel(user: ReturnType<typeof userEvent.setup>, name: string) {
  fireEvent.click(tile(name));
  await user.click(screen.getByRole("button", { name: `Edit ${name}` }));
  await screen.findByLabelText("Pieces");
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.server = { version: 1, rows: [row("d1", "Pant"), row("d2", "Tee", { col: 5, pieceCount: 4 })] };
  // A save takes a moment, as it does over a network: that is where the races are.
  actions.saveChangeAction.mockImplementation(async (_fixture: string, change: Change) => {
    await pause(20);
    return serve(change);
  });
  actions.reloadDraftAction.mockImplementation(() => Promise.resolve(draftOf()));
});

/** The words of every live region on screen that has some, and isn't hidden from a screen reader. */
function heard(): string[] {
  const regions = [...document.querySelectorAll<HTMLElement>('[aria-live], [role="status"], [role="alert"]')];
  return regions.filter((r) => !r.closest('[aria-hidden="true"]')).flatMap((r) => [...r.childNodes].map((n) => (n instanceof HTMLElement && n.closest('[aria-hidden="true"]') ? "" : (n.textContent ?? "").trim()))).filter(Boolean);
}

describe("one typed panel edit is announced once", () => {
  it("Saved is heard from the panel's line only: not from the corner indicator, and not as 'Changed to …'", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(pieces(), { target: { value: "5" } });
    fireEvent.blur(pieces());
    await waitFor(() => expect(fake.server.rows[0].pieceCount).toBe(5));
    await waitFor(() => expect(document.querySelector("[data-panel-status]")).toHaveTextContent("Saved"));
    await pause(50);
    expect(heard()).toEqual(["Saved"]);
    expect(document.querySelector("[data-draft-status]")).not.toHaveAttribute("aria-live");
    expect(document.querySelector("[data-draft-status]")).not.toHaveAttribute("role");
  });

  it("with the panel closed, the corner indicator is the live Saved again", async () => {
    const user = userEvent.setup();
    show();
    fireEvent.click(tile("Pant"));
    fireEvent.keyDown(tile("Pant"), { key: "ArrowRight" });
    await waitFor(() => expect(document.querySelector("[data-draft-status]")).toHaveTextContent("Saved"));
    expect(document.querySelector("[data-draft-status]")).toHaveAttribute("aria-live", "polite");
    await user.keyboard("{Escape}");
  });

  it("a refusal is heard once, on the draft's status line; the panel shows it inline too, but silently", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    actions.saveChangeAction.mockImplementationOnce(async () => ({ status: "refused", message: "Blocked by Tee", draft: draftOf() }));
    fireEvent.change(pieces(), { target: { value: "5" } });
    fireEvent.blur(pieces());
    await waitFor(() => expect(document.querySelector("[data-draft-refusal]")).toHaveTextContent("Blocked by Tee"));
    await pause(50);
    // Visible inline in the panel...
    expect(document.querySelector("[data-panel-status]")).toHaveTextContent("Couldn't save");
    expect(screen.getByText("Blocked by Tee", { selector: "#" + (pieces().getAttribute("aria-describedby") ?? "none") })).toBeVisible();
    // ...but one voice.
    expect(heard()).toEqual(["Blocked by Tee"]);
  });

  it("a value that breaks a rule is still announced by the form, since nothing else says it", async () => {
    const user = userEvent.setup();
    show();
    await openPanel(user, "Pant");
    fireEvent.change(screen.getByLabelText("From left (ft)"), { target: { value: "2.25" } });
    fireEvent.blur(screen.getByLabelText("From left (ft)"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Use feet in half steps"));
    expect(heard()).toEqual(["Use feet in half steps, like 4 or 4½."]);
  });
});

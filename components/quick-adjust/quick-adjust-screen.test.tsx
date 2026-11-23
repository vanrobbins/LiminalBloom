// The adjust page (0.7.0.9 spec §5.1, §7): tiles marked, a tap opens the panel with its suggestions, a choice saves at once
// and redraws the tile, ?product= opens its tile's panel, Ctrl+Z steps back, and the bar shows Publish only to publishers.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedVersion } from "@/lib/planograms/queries";
import type { AdjustmentState, ChangeRow } from "@/lib/planograms/adjust";
import { entry, FACE } from "@/lib/planograms/test-adjust";
import type { PlanogramScope } from "@/lib/planograms/types";
import { EVERYTHING } from "@/lib/access/test-guard";
import type { Switch } from "@/lib/access/switches";

const actions = vi.hoisted(() => ({
  openAdjustmentAction: vi.fn(), setChangeAction: vi.fn(), suggestionsForAction: vi.fn(), previewAdjustmentAction: vi.fn(), publishAdjustmentAction: vi.fn(), discardAdjustmentAction: vi.fn(),
}));
vi.mock("@/app/(app)/planograms/adjust-actions", () => actions);
vi.mock("@/app/(app)/planograms/actions", () => ({ pickerSearch: vi.fn(async () => []) }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import { QuickAdjustScreen } from "./quick-adjust-screen";

const scope: PlanogramScope = { fixtureId: "fx", fixtureName: "Wall bay 3", isSet: false, faces: [FACE] };
const straight = entry({ productId: "straight", productName: "Straight jean", col: 0 });
const tee = entry({ productId: "tee", productName: "Pocket tee", col: 4 });
const version: PublishedVersion = { number: 3, publishedAt: new Date("2026-11-09T12:00:00Z"), publishedByName: "Van", summary: null, placements: [straight, tee] };
const looks = {
  straight: { imageKey: null, categoryName: "Jeans", status: "sold_out" as const },
  tee: { imageKey: null, categoryName: "Tops" },
  slim: { imageKey: null, categoryName: "Jeans" },
};
const slimSuggestion = { productId: "slim", name: "Slim jean", styleNumber: "S-9", colSpan: 2, rowSpan: 2, tier: 1, reason: "Same category and colour" };
const row = (version: number): ChangeRow => ({
  id: "c1", version, kind: "replace", target: straight, pieceCount: 4, replacement: { productId: "slim", productName: "Slim jean", styleNumber: "S-9", colSpan: 2, rowSpan: 2 },
});
const draft = (version: number, changes: ChangeRow[] = []): AdjustmentState => ({
  id: "adj", planogramId: "p", state: "draft", basedOnVersion: 3, version, createdByName: "Sam", createdAt: new Date(), publishedAt: null, publishedByName: null, changes,
});

function show(props: { draft?: AdjustmentState | null; productId?: string | null; switches?: readonly Switch[] } = {}) {
  const member = { switches: props.switches ?? EVERYTHING.switches };
  return render(<QuickAdjustScreen scope={scope} version={version} draft={props.draft ?? null} published={null} looks={looks} productId={props.productId ?? null} member={member} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  actions.suggestionsForAction.mockResolvedValue([slimSuggestion]);
  actions.openAdjustmentAction.mockResolvedValue({ status: "saved", draft: draft(1), looks });
});

describe("QuickAdjustScreen", () => {
  it("marks the sold-out tile and draws no controls to move, resize or add", () => {
    show();
    expect(screen.getByRole("button", { name: /^Straight jean, sold out, / })).toHaveAttribute("data-status", "sold_out");
    expect(screen.queryByRole("button", { name: /^Add product/ })).toBeNull();
    expect(document.querySelector("[data-lifted]")).toBeNull();
  });

  it("a tap opens the panel on that tile with its suggestions, Keep first and Leave empty last", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: /^Straight jean, sold out, / }));
    const panel = await screen.findByRole("complementary", { name: "Straight jean" });
    const radios = await within(panel).findAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Keep Straight jeanSold out", "Slim jeanSame category and colour · S-9", "Leave empty"]);
    expect(actions.suggestionsForAction).toHaveBeenCalledWith("fx", { faceId: straight.faceId, productId: "straight", col: 0, row: 0, depth: 0 });
  });

  it("?product= opens the panel on that product's first tile with nothing tapped", async () => {
    show({ productId: "straight" });
    expect(await screen.findByRole("complementary", { name: "Straight jean" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Straight jean, sold out, / })).toHaveAttribute("aria-pressed", "true");
  });

  it("without ?product= no panel is open", () => {
    show();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("choosing a suggestion saves at once and redraws the tile as the replacement, marked with what it replaces", async () => {
    actions.setChangeAction.mockResolvedValue({ status: "saved", draft: draft(2, [row(0)]), looks });
    show({ draft: draft(1), productId: "straight" });
    await userEvent.click(await screen.findByRole("radio", { name: /^Slim jean/ }));
    expect(actions.setChangeAction).toHaveBeenCalledWith("fx", "adj", { faceId: straight.faceId, productId: "straight", col: 0, row: 0, depth: 0 }, { kind: "replace", productId: "slim" }, null);
    expect(await screen.findByRole("button", { name: /^Slim jean, replaces Straight jean, / })).toHaveAttribute("data-status", "replaced");
    expect(screen.getByRole("radio", { name: /^Slim jean/ })).toBeChecked();
    expect(screen.getByText("Slim jean replaces Straight jean")).toHaveAttribute("aria-live", "polite");
  });

  it("Leave empty draws the tile dashed, named for what it was", async () => {
    actions.setChangeAction.mockResolvedValue({ status: "saved", draft: draft(2, [{ ...row(0), kind: "empty" } as ChangeRow]), looks });
    show({ draft: draft(1), productId: "straight" });
    await userEvent.click(await screen.findByRole("radio", { name: /^Leave empty/ }));
    expect(await screen.findByRole("button", { name: /^Empty, was Straight jean, / })).toHaveAttribute("data-status", "empty");
  });

  it("Ctrl+Z puts the tile back, with no button pressed", async () => {
    actions.setChangeAction.mockResolvedValueOnce({ status: "saved", draft: draft(2, [row(0)]), looks }).mockResolvedValueOnce({ status: "saved", draft: draft(3), looks });
    show({ draft: draft(1), productId: "straight" });
    await userEvent.click(await screen.findByRole("radio", { name: /^Slim jean/ }));
    await screen.findByRole("button", { name: /^Slim jean, replaces/ });
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(actions.setChangeAction).toHaveBeenLastCalledWith("fx", "adj", expect.anything(), { kind: "keep" }, 0));
    expect(await screen.findByRole("button", { name: /^Straight jean, sold out, / })).toBeInTheDocument();
  });

  it("the bar has Undo, Redo, Compare and Discard for a drafter, and Publish only with planograms.publish; none of it is `disabled`", () => {
    const { unmount } = show({ switches: ["view", "planograms.draft"] });
    for (const name of ["Undo", "Redo", "Compare", "Discard"]) expect(screen.getByRole("button", { name }), name).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    unmount();
    show({ switches: ["view", "planograms.draft", "planograms.publish"] });
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: /^(Undo|Redo|Compare|Publish|Discard)$/ })) expect(button).toHaveAttribute("aria-disabled");
    for (const button of screen.getAllByRole("button", { name: /^(Undo|Redo|Compare|Publish|Discard)$/ })) expect(button).not.toBeDisabled();
  });

  it("Publish is live only with a change in the draft, and opens Compare with the confirm", async () => {
    actions.previewAdjustmentAction.mockResolvedValue(null);
    show({ draft: draft(2, [row(0)]) });
    const publish = screen.getByRole("button", { name: "Publish" });
    expect(publish).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(publish);
    expect(await screen.findByRole("dialog", { name: "Publish to this store?" })).toBeInTheDocument();
  });

  it("Discard asks first and, once confirmed, discards the draft and goes back to the planogram", async () => {
    actions.discardAdjustmentAction.mockResolvedValue({ status: "saved", message: "Quick Adjust discarded" });
    show({ draft: draft(2, [row(0)]) });
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = screen.getByRole("dialog", { name: "Discard this Quick Adjust?" });
    expect(dialog).toHaveTextContent("The floor stays as it is.");
    expect(actions.discardAdjustmentAction).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    expect(actions.discardAdjustmentAction).toHaveBeenCalledWith("fx", "adj", 2);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/planograms/fx"));
  });

  it("says which version it adjusts, with the glossary beside it", () => {
    show();
    expect(screen.getByText(/Quick Adjust on Version 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What's quick adjust?" })).toBeInTheDocument();
  });
});

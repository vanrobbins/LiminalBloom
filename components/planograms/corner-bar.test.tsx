// The corner bar (0.7.0.5 task 4, spec §2.1): which controls show for which
// permissions and states, and that Publish and Discard open the dialogs they
// always did. The saving indicator's timing is draft-status.test.tsx.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ previewPublishAction: vi.fn(), publishAction: vi.fn(), discardDraftAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const toasts = vi.hoisted(() => ({ toast: vi.fn(), dismissToast: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

import { CornerBar } from "./corner-bar";

type Props = React.ComponentProps<typeof CornerBar>;

const base: Props = {
  fixtureId: "fx",
  row: null,
  editing: true,
  draftVersion: 3,
  status: { kind: "idle" },
  canAdd: true,
  onAdd: vi.fn(),
  canPublish: true,
  canUndo: true,
  canRedo: true,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onLeave: vi.fn(),
};
const show = (over: Partial<Props> = {}) => render(<CornerBar {...base} {...over} />);
const button = (name: string) => screen.queryByRole("button", { name });

describe("CornerBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a drafter in a draft gets Undo, Redo, Add and the ⋯ menu, but not Publish", () => {
    show({ canPublish: false });
    for (const name of ["Undo", "Redo", "Add product", "More draft actions"]) expect(button(name), name).not.toBeNull();
    expect(button("Publish…")).toBeNull();
  });

  it("with the publish switch too, Publish is there and is the only filled button", () => {
    show();
    const publish = screen.getByRole("button", { name: "Publish…" });
    expect(publish).toHaveClass("bg-brand");
    for (const other of screen.getAllByRole("button").filter((b) => b !== publish)) expect(other, other.getAttribute("aria-label") ?? "").not.toHaveClass("bg-brand");
    // The word comes from tablet width; the icon alone before that.
    expect(publish.querySelector("span")).toHaveClass("hidden", "md:inline");
  });

  it("with nothing to offer (no draft shown, nothing to add to), the bar is not there at all", () => {
    const { container } = show({ editing: false, canAdd: false, status: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("with no draft yet, only Add shows: Undo, Redo, Publish, the menu and the indicator wait for the draft", () => {
    show({ editing: false, status: null });
    expect(button("Add product")).not.toBeNull();
    for (const name of ["Undo", "Redo", "Publish…", "More draft actions"]) expect(button(name), name).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("Undo and Redo are disabled with nothing to undo or redo, and act when pressed", async () => {
    const user = userEvent.setup();
    const { rerender } = show({ canUndo: false, canRedo: false });
    expect(button("Undo")).toBeDisabled();
    expect(button("Redo")).toBeDisabled();
    rerender(<CornerBar {...base} canUndo canRedo={false} />);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(base.onUndo).toHaveBeenCalledTimes(1);
    expect(button("Redo")).toBeDisabled();
    rerender(<CornerBar {...base} canUndo={false} canRedo />);
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(base.onRedo).toHaveBeenCalledTimes(1);
  });

  it("Add opens through the caller", async () => {
    await userEvent.click(show().getByRole("button", { name: "Add product" }));
    expect(base.onAdd).toHaveBeenCalledTimes(1);
  });

  it("the save indicator is a status, not a button, and can't take focus", () => {
    show({ status: { kind: "saved" } });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saved");
    expect(status).not.toHaveAttribute("tabindex");
    expect(status.closest("button")).toBeNull();
  });

  it("Publish… opens the existing Publish dialog", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 3, basedOnVersion: null, nextNumber: 1, changes: [], issues: [], isEmpty: false });
    await userEvent.click(show().getByRole("button", { name: "Publish…" }));
    expect(await screen.findByRole("button", { name: /^Publish to / })).toBeInTheDocument();
  });

  it("⋯ offers Discard draft…, which asks first and leaves when confirmed", async () => {
    actions.discardDraftAction.mockResolvedValue({ status: "saved", message: "Draft discarded" });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "More draft actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Discard draft…" }));
    const dialog = await screen.findByRole("dialog", { name: "Discard this draft?" });
    expect(actions.discardDraftAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(base.onLeave).toHaveBeenCalledTimes(1));
    expect(actions.discardDraftAction).toHaveBeenCalledWith("fx", 3);
  });

  it("closing the Discard dialog puts focus back on the corner bar’s ⋯ (Escape: e2e planograms)", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "More draft actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Discard draft…" }));
    const dialog = await screen.findByRole("dialog", { name: "Discard this draft?" });
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.getByRole("button", { name: "More draft actions" })).toHaveFocus());
  });
  async function openDiscard(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "More draft actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Discard draft…" }));
    return screen.findByRole("dialog", { name: "Discard this draft?" });
  }

  it("while a discard is in flight the dialog can't be dismissed, so it can't be confirmed twice", async () => {
    let finish: (reply: { status: "saved"; message: string }) => void = () => {};
    actions.discardDraftAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    show();
    const dialog = await openDiscard(user);
    await user.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    expect(within(dialog).getByRole("button", { name: "Discarding…" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Discard this draft?" })).toBeInTheDocument();
    finish({ status: "saved", message: "Draft discarded" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions.discardDraftAction).toHaveBeenCalledTimes(1);
  });

  it("a discard that throws says so, keeps the dialog open and lets it be confirmed again", async () => {
    actions.discardDraftAction.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ status: "saved", message: "Draft discarded" });
    const user = userEvent.setup();
    show();
    const dialog = await openDiscard(user);
    await user.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't discard" })));
    expect(within(dialog).getByRole("button", { name: "Discard draft" })).toBeEnabled();
    expect(base.onLeave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(base.onLeave).toHaveBeenCalledTimes(1));
    expect(actions.discardDraftAction).toHaveBeenCalledTimes(2);
  });

  it("when the ⋯ is gone after a discard, focus goes to the page's main area, not the top of the page", async () => {
    actions.discardDraftAction.mockResolvedValue({ status: "saved", message: "Draft discarded" });
    const main = document.createElement("main");
    main.id = "content";
    main.tabIndex = -1;
    document.body.append(main);
    function Host() {
      const [editing, setEditing] = useState(true);
      return <CornerBar {...base} editing={editing} onLeave={() => setEditing(false)} />;
    }
    const user = userEvent.setup();
    render(<Host />);
    const dialog = await openDiscard(user);
    await user.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "More draft actions" })).toBeNull();
    await waitFor(() => expect(main).toHaveFocus());
    main.remove();
  });
});

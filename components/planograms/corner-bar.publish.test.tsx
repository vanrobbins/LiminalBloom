// The corner bar (0.7.0.5 task 4, spec §2.1): which controls show for which
// permissions and states, and that Publish and Discard open the dialogs they
// always did. The saving indicator's timing is draft-status.test.tsx.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ previewPublishAction: vi.fn(), publishAction: vi.fn(), discardDraftAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => ({ ...actions, setDueDateAction: vi.fn() }));
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
  dueDate: null,
  canSetDueDate: true,
  onLeave: vi.fn(),
};
const show = (over: Partial<Props> = {}) => render(<CornerBar {...base} {...over} />);
describe("CornerBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closing the Publish dialog without publishing leaves focus to return to the Publish button", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 3, basedOnVersion: null, nextNumber: 1, changes: [], issues: [], isEmpty: false, adjustments: [], soldOut: [] });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toHaveFocus());
  });

  it("the trash button asks first and leaves when confirmed", async () => {
    actions.discardDraftAction.mockResolvedValue({ status: "saved", message: "Draft discarded" });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Discard draft" }));
    const dialog = await screen.findByRole("dialog", { name: "Discard this draft?" });
    expect(actions.discardDraftAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(base.onLeave).toHaveBeenCalledTimes(1));
    expect(actions.discardDraftAction).toHaveBeenCalledWith("fx", 3);
  });

  it("closing the Discard dialog puts focus back on the trash button (Escape: e2e planograms)", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Discard draft" }));
    const dialog = await screen.findByRole("dialog", { name: "Discard this draft?" });
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.getByRole("button", { name: "Discard draft" })).toHaveFocus());
  });

  async function openDiscard(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Discard draft" }));
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

  it("when the trash is gone after a discard, focus goes to the page's main area, not the top of the page", async () => {
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
    expect(screen.queryByRole("button", { name: "Discard draft" })).toBeNull();
    await waitFor(() => expect(main).toHaveFocus());
    main.remove();
  });

  it("after a successful discard focus goes to the main area even while the trash is still mounted (it goes on the reload)", async () => {
    actions.discardDraftAction.mockResolvedValue({ status: "saved", message: "Draft discarded" });
    const main = document.createElement("main");
    main.id = "content";
    main.tabIndex = -1;
    document.body.append(main);
    const user = userEvent.setup();
    show();
    const dialog = await openDiscard(user);
    await user.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeInTheDocument();
    await waitFor(() => expect(main).toHaveFocus());
    main.remove();
  });

  it("a refused discard closes the dialog, says why, reloads, and leaves nothing to confirm", async () => {
    actions.discardDraftAction.mockResolvedValue({ status: "refused", message: "Already published on another device" });
    const user = userEvent.setup();
    show();
    const dialog = await openDiscard(user);
    await user.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Already published on another device" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(base.onLeave).not.toHaveBeenCalled();
  });
});

// The corner bar (0.7.0.5 task 4, spec §2.1): which controls show for which
// permissions and states, and that Publish and Discard open the dialogs they
// always did. The saving indicator's timing is draft-status.test.tsx.

import { render, screen, waitFor } from "@testing-library/react";
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
const button = (name: string) => screen.queryByRole("button", { name });

describe("CornerBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a drafter in a draft gets Undo, Redo, Add, Discard draft and the ⋯ menu, but not Publish", () => {
    show({ canPublish: false });
    for (const name of ["Undo", "Redo", "Add product", "Discard draft", "More actions"]) expect(button(name), name).not.toBeNull();
    expect(button("Publish")).toBeNull();
  });

  it("with the publish switch too, Publish is there, the only filled button, and an icon at every size", () => {
    show();
    const publish = screen.getByRole("button", { name: "Publish" });
    expect(publish).toHaveClass("bg-brand");
    for (const other of screen.getAllByRole("button").filter((b) => b !== publish)) expect(other, other.getAttribute("aria-label") ?? "").not.toHaveClass("bg-brand");
    expect(publish).toHaveTextContent("");
    expect(publish.querySelector("svg")).not.toBeNull();
  });

  it("Undo and Redo are ghosts (no box); Discard draft sits beside Publish, in the order Publish, Discard, ⋯", () => {
    show();
    for (const name of ["Undo", "Redo"]) expect(button(name), name).not.toHaveClass("border");
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names.slice(-3)).toEqual(["Publish", "Discard draft", "More actions"]);
  });

  it("⋯ holds Set due date, which opens the editor, and Version history once published", async () => {
    const user = userEvent.setup();
    show({ row: { id: "r", fixtureId: "fx", basedOnVersion: null, publishedVersion: 2, hasDraft: true, dueDate: null, version: 5 } });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("menuitem", { name: "Version history" })).toHaveAttribute("href", "/planograms/fx/history");
    expect(screen.queryByRole("menuitem", { name: "Discard draft…" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Set due date" }));
    expect(await screen.findByRole("dialog", { name: "Set due date" })).toBeInTheDocument();
  });

  it("with a date set the item reads Change due date; without the publish switch it is gone, and with nothing left there is no ⋯", async () => {
    const user = userEvent.setup();
    const { rerender } = show({ dueDate: "2026-10-14" });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("menuitem", { name: "Change due date" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    rerender(<CornerBar {...base} canSetDueDate={false} />);
    expect(button("More actions")).toBeNull();
  });

  it("with nothing to offer (no draft shown, nothing to add to), the bar is not there at all", () => {
    const { container } = show({ editing: false, canAdd: false, status: null, canSetDueDate: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("with no draft yet, only Add shows: Undo, Redo, Publish, the menu and the indicator wait for the draft", () => {
    show({ editing: false, status: null });
    expect(button("Add product")).not.toBeNull();
    for (const name of ["Undo", "Redo", "Publish", "Discard draft"]) expect(button(name), name).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("Undo and Redo are aria-disabled (not disabled) with nothing to undo or redo, do nothing then, and act when pressed", async () => {
    const user = userEvent.setup();
    const { rerender } = show({ canUndo: false, canRedo: false });
    for (const name of ["Undo", "Redo"]) {
      expect(button(name)).toHaveAttribute("aria-disabled", "true");
      expect(button(name)).toBeEnabled();
      expect(button(name)).toHaveClass("aria-disabled:opacity-60");
      await user.click(screen.getByRole("button", { name }));
    }
    expect(base.onUndo).not.toHaveBeenCalled();
    expect(base.onRedo).not.toHaveBeenCalled();
    rerender(<CornerBar {...base} canUndo canRedo={false} />);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(base.onUndo).toHaveBeenCalledTimes(1);
    expect(button("Undo")).not.toHaveAttribute("aria-disabled", "true");
    expect(button("Redo")).toHaveAttribute("aria-disabled", "true");
    rerender(<CornerBar {...base} canUndo={false} canRedo />);
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(base.onRedo).toHaveBeenCalledTimes(1);
  });

  it("pressing Undo from the keyboard until nothing is left keeps focus on Undo", async () => {
    function Host() {
      const [steps, setSteps] = useState(2);
      return <CornerBar {...base} canUndo={steps > 0} canRedo={false} onUndo={() => setSteps((n) => n - 1)} />;
    }
    const user = userEvent.setup();
    render(<Host />);
    const undo = screen.getByRole("button", { name: "Undo" });
    undo.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    expect(undo).toHaveAttribute("aria-disabled", "true");
    expect(undo).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(undo).toHaveFocus();
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
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 3, basedOnVersion: null, nextNumber: 1, changes: [], issues: [], isEmpty: false, adjustments: [], soldOut: [] });
    await userEvent.click(show().getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("button", { name: /^Publish to / })).toBeInTheDocument();
  });

  it("after a Publish that went through, focus goes to the main area, not the page top (the Publish button goes on the reload)", async () => {
    actions.previewPublishAction.mockResolvedValue({ planogramVersion: 3, basedOnVersion: null, nextNumber: 1, changes: [], issues: [], isEmpty: false, adjustments: [], soldOut: [] });
    actions.publishAction.mockResolvedValue({ status: "saved", message: "Published" });
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
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await user.click(await screen.findByRole("button", { name: /^Publish to / }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    try {
      await waitFor(() => expect(main).toHaveFocus());
    } finally {
      main.remove();
    }
  });
});

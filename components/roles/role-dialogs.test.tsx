import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ saveSwitchesAction: vi.fn(), moveRoleAction: vi.fn(), renameRoleAction: vi.fn(), resetRoleAction: vi.fn(), deleteRoleAction: vi.fn(), createRoleAction: vi.fn() }));
vi.mock("@/app/(app)/store/roles/actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toastMock);

import { DeleteDialog } from "./delete-dialog";
import { RenameDialog } from "./rename-dialog";
import { ResetDialog } from "./reset-dialog";

import { customRole, storeManagerView } from "./test-view";

beforeEach(() => vi.clearAllMocks());

const noFocus = (event: Event) => event.preventDefault();
const rowOf = (view: ReturnType<typeof storeManagerView>, id: string) => view.roles.find((r) => r.id === id)!;

describe("RenameDialog", () => {
  it("keeps Save off until the name changes, sends the version seen, and reports the rename", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    actions.renameRoleAction.mockResolvedValue({ status: "renamed", from: "Sales Associate", to: "Educator" });
    render(<RenameDialog row={rowOf(storeManagerView(), "sales_associate")} onClose={onClose} onCloseAutoFocus={noFocus} />);
    expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Educator");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(actions.renameRoleAction).toHaveBeenCalledWith("sales_associate", 1, "Educator");
    await waitFor(() => expect(onClose).toHaveBeenCalledWith({ from: "Sales Associate", to: "Educator" }));
  });

  it.each([
    [{ status: "taken" }, "Another role is already called Educator."],
    [{ status: "long-name" }, "Keep the name to 40 characters."],
    [{ status: "forbidden" }, "Your role can't do this anymore."],
    [{ status: "stale" }, "Sales Associate changed meanwhile, so nothing was saved. Close and look again."],
    [{ status: "gone" }, "Sales Associate was deleted meanwhile. Close and look again."],
  ])("says %j in words", async (result, words) => {
    const user = userEvent.setup();
    actions.renameRoleAction.mockResolvedValue(result);
    render(<RenameDialog row={rowOf(storeManagerView(), "sales_associate")} onClose={vi.fn()} onCloseAutoFocus={noFocus} />);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Educator");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText(words)).toBeInTheDocument();
  });
});

describe("ResetDialog", () => {
  it("shows what the role can again do, resets, and says when resetting would change a permission the viewer lacks", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    actions.resetRoleAction.mockResolvedValueOnce({ status: "grant" }).mockResolvedValueOnce({ status: "reset", name: "Visual Merchandising Worker" });
    render(<ResetDialog row={rowOf(storeManagerView(), "vm_worker")} onClose={onClose} onCloseAutoFocus={noFocus} />);
    expect(screen.getByText("Its name goes back to Visual Merchandising Worker and it can again:")).toBeInTheDocument();
    expect(screen.getByText("Put a product on sale or take it off sale")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset role" }));
    expect(await screen.findByText("Resetting would change a permission your role doesn't have.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset role" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("Visual Merchandising Worker"));
  });
});

describe("DeleteDialog", () => {
  const view = (people = { names: [] as string[], invitations: 0 }) => storeManagerView([customRole("edu", 450, ["view"], people)]);
  const destinations = (v: ReturnType<typeof view>) => v.roles.filter((r) => r.editable);

  it("confirms plainly when nobody holds the role", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    actions.deleteRoleAction.mockResolvedValue({ status: "deleted", name: "edu", moved: 0, movedTo: null });
    const v = view();
    render(<DeleteDialog row={rowOf(v, "edu")} destinations={destinations(v)} canMovePeople onClose={onClose} onCloseAutoFocus={noFocus} />);
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete role" }));
    expect(actions.deleteRoleAction).toHaveBeenCalledWith("edu", 1, null, 0, 0);
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("Deleted edu"));
  });

  it("names the people, offers only roles below the viewer's own with the role just below as the start, and moves them with the counts it showed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    actions.deleteRoleAction.mockResolvedValue({ status: "deleted", name: "edu", moved: 3, movedTo: "Sales Associate" });
    const v = view({ names: ["Dee", "Eli"], invitations: 1 });
    render(<DeleteDialog row={rowOf(v, "edu")} destinations={destinations(v)} canMovePeople onClose={onClose} onCloseAutoFocus={noFocus} />);
    expect(screen.getByText("2 people have this role. Move them to another role first; it happens in the same step.")).toBeInTheDocument();
    expect(screen.getByText("1 waiting invitation moves too.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete role" })).toBeNull();
    const select = screen.getByLabelText("Move them to") as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]);
    expect(select.selectedOptions[0].text).toBe("Sales Associate");
    await user.click(screen.getByRole("button", { name: "Move 3 people and delete" }));
    expect(actions.deleteRoleAction).toHaveBeenCalledWith("edu", 1, "sales_associate", 2, 1);
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("Moved 2 people and 1 waiting invitation to Sales Associate and deleted edu"));
  });

  it("refreshes the list in place when the people changed, and moves nobody", async () => {
    const user = userEvent.setup();
    actions.deleteRoleAction.mockResolvedValue({ status: "people-changed", names: ["Dee", "Eli", "Fay"], invitations: 0 });
    const v = view({ names: ["Dee"], invitations: 0 });
    const onClose = vi.fn();
    render(<DeleteDialog row={rowOf(v, "edu")} destinations={destinations(v)} canMovePeople onClose={onClose} onCloseAutoFocus={noFocus} />);
    await user.click(screen.getByRole("button", { name: "Move 1 person and delete" }));
    expect(await screen.findByText("Someone joined or left this role meanwhile. Check the list.")).toBeInTheDocument();
    expect(screen.getByText("Fay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move 3 people and delete" })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("tells a viewer who can't manage people so, and turns the button off", () => {
    const v = view({ names: ["Dee"], invitations: 0 });
    render(<DeleteDialog row={rowOf(v, "edu")} destinations={destinations(v)} canMovePeople={false} onClose={vi.fn()} onCloseAutoFocus={noFocus} />);
    expect(screen.getByText("Your role can't move people. Ask someone who manages people.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move 1 person and delete" })).toBeDisabled();
  });
});

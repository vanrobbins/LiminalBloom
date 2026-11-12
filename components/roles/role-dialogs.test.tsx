import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ saveSwitchesAction: vi.fn(), moveRoleAction: vi.fn(), renameRoleAction: vi.fn(), resetRoleAction: vi.fn(), deleteRoleAction: vi.fn(), createRoleAction: vi.fn() }));
vi.mock("@/app/(app)/roles/actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toastMock);

import { AddRoleDialog } from "./add-role-dialog";
import { DeleteDialog } from "./delete-dialog";
import { RenameDialog } from "./rename-dialog";
import { ResetDialog } from "./reset-dialog";
import { RolesScreen } from "./roles-screen";
import { assistantManagerView, customRole, storeManagerView } from "./test-view";

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

describe("AddRoleDialog", () => {
  it("names the role that blocks it until the choice nests, and sends the name, the place and the permissions", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    actions.createRoleAction.mockResolvedValue({ status: "created", name: "Educator" });
    render(<AddRoleDialog view={storeManagerView()} onClose={onClose} onCloseAutoFocus={noFocus} />);
    const dialog = within(screen.getByRole("dialog", { name: "New role" }));
    await user.type(dialog.getByLabelText("Name"), "Educator");
    await user.selectOptions(dialog.getByLabelText("Place it"), "Below Visual Merchandising Manager");
    expect(dialog.getByText(/Sales Associate can mark products sold out, so Educator must be able to as well, placed above it\./)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Add role" })).toBeDisabled();
    for (const name of ["Mark sold out", "Run sales", "Draft planograms"]) await user.click(dialog.getByRole("checkbox", { name }));
    expect(dialog.queryByText(/must be able to as well/)).toBeNull();
    await user.click(dialog.getByRole("button", { name: "Add role" }));
    expect(actions.createRoleAction).toHaveBeenCalledWith("Educator", "vm_manager", ["view", "products.stock", "products.sale", "planograms.draft"]);
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("Educator"));
  });

  it("offers every place from the viewer's own role down, starts at the bottom, and only enables permissions the viewer holds", () => {
    render(<AddRoleDialog view={assistantManagerView()} onClose={vi.fn()} onCloseAutoFocus={noFocus} />);
    const place = screen.getByLabelText("Place it") as HTMLSelectElement;
    expect([...place.options].map((o) => o.text)).toEqual(["Below Assistant Manager", "Below Visual Merchandising Manager", "Below Visual Merchandising Worker", "Below Sales Associate"]);
    expect(place.selectedOptions[0].text).toBe("Below Sales Associate");
    expect(screen.getByRole("checkbox", { name: "Run sales" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Store settings" })).toBeDisabled();
  });

  it("says a name is taken", async () => {
    const user = userEvent.setup();
    actions.createRoleAction.mockResolvedValue({ status: "taken" });
    render(<AddRoleDialog view={storeManagerView()} onClose={vi.fn()} onCloseAutoFocus={noFocus} />);
    await user.type(screen.getByLabelText("Name"), "Educator");
    await user.click(screen.getByRole("button", { name: "Add role" }));
    expect(await screen.findByText("Another role is already called Educator.")).toBeInTheDocument();
  });
});

describe("the ⋯ menu", () => {
  it("opens Rename from the menu and moves a custom role with the neighbour it saw, saying so, or why not", async () => {
    const user = userEvent.setup();
    const view = storeManagerView([customRole("edu", 550, ["view", "products.stock"])]);
    render(<RolesScreen view={view} />);
    const menu = within(screen.getByRole("region", { name: "Permissions by role" }));
    await user.click(menu.getByRole("button", { name: "More for edu" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Rename", "Move up", "Delete"]);
    actions.moveRoleAction.mockResolvedValueOnce({ status: "moved", name: "edu", past: "Sales Associate", direction: "up" });
    await user.click(screen.getByRole("menuitem", { name: "Move up" }));
    expect(actions.moveRoleAction).toHaveBeenCalledWith("edu", "up", "sales_associate");
    await waitFor(() => expect(toastMock.toast).toHaveBeenCalledWith({ tone: "success", title: "Moved edu above Sales Associate" }));
    actions.moveRoleAction.mockResolvedValueOnce({ status: "nesting", problem: { role: { id: "sales_associate", name: "Sales Associate" }, other: { id: "edu", name: "edu" }, switch: "products.stock", direction: "on" } });
    await user.click(menu.getByRole("button", { name: "More for edu" }));
    await user.click(screen.getByRole("menuitem", { name: "Move up" }));
    await waitFor(() => expect(toastMock.toast).toHaveBeenCalledWith({ tone: "error", title: "Can't move edu there", description: "edu can't mark products sold out, so Sales Associate can't either." }));
    await user.click(menu.getByRole("button", { name: "More for edu" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByRole("dialog", { name: "Rename edu" })).toBeInTheDocument();
  });
});

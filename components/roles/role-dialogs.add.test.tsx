import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ saveSwitchesAction: vi.fn(), moveRoleAction: vi.fn(), renameRoleAction: vi.fn(), resetRoleAction: vi.fn(), deleteRoleAction: vi.fn(), createRoleAction: vi.fn() }));
vi.mock("@/app/(app)/store/roles/actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toastMock);

import { AddRoleDialog } from "./add-role-dialog";

import { RolesScreen } from "./roles-screen";
import { assistantManagerView, customRole, storeManagerView } from "./test-view";

beforeEach(() => vi.clearAllMocks());

const noFocus = (event: Event) => event.preventDefault();
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
  const menuOf = () => within(screen.getByRole("region", { name: "Permissions by role" }));
  async function chooseMoveUp(user: ReturnType<typeof userEvent.setup>) {
    await user.click(menuOf().getByRole("button", { name: "More for edu" }));
    await user.click(screen.getByRole("menuitem", { name: "Move up" }));
  }

  it("opens Rename from the menu", async () => {
    const user = userEvent.setup();
    render(<RolesScreen view={storeManagerView([customRole("edu", 550, ["view", "products.stock"])])} />);
    await user.click(menuOf().getByRole("button", { name: "More for edu" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Rename", "Move up", "Delete"]);
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByRole("dialog", { name: "Rename edu" })).toBeInTheDocument();
  });

  it("moves a custom role with the neighbour it saw: no toast, the row just moves, a screen reader is told", async () => {
    const user = userEvent.setup();
    render(<RolesScreen view={storeManagerView([customRole("edu", 550, ["view", "products.stock"])])} />);
    actions.moveRoleAction.mockResolvedValueOnce({ status: "moved", name: "edu", past: "Sales Associate", direction: "up" });
    await chooseMoveUp(user);
    expect(actions.moveRoleAction).toHaveBeenCalledWith("edu", "up", "sales_associate");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
    expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Moved edu above Sales Associate");
    expect(toastMock.toast).not.toHaveBeenCalled();
  });

  it("says why a move can't happen under that role's row, not in a toast, and the next move clears it", async () => {
    const user = userEvent.setup();
    render(<RolesScreen view={storeManagerView([customRole("edu", 550, ["view", "products.stock"])])} />);
    actions.moveRoleAction.mockResolvedValueOnce({ status: "nesting", problem: { role: { id: "sales_associate", name: "Sales Associate" }, other: { id: "edu", name: "edu" }, switch: "products.stock", direction: "on" } });
    await chooseMoveUp(user);
    const line = await menuOf().findByText("Can't move edu there. edu can't mark products sold out, so Sales Associate can't either.");
    expect(line.closest("tr")?.previousElementSibling).toHaveTextContent("edu");
    expect(toastMock.toast).not.toHaveBeenCalled();
    // The next move starts: the old refusal goes at once, before its answer is back.
    actions.moveRoleAction.mockReturnValueOnce(new Promise(() => {}));
    await chooseMoveUp(user);
    expect(menuOf().queryByText(/Can't move edu there/)).toBeNull();
  });

  it("says a refusal under the row, and keeps a lost connection a toast", async () => {
    const user = userEvent.setup();
    render(<RolesScreen view={storeManagerView([customRole("edu", 550, ["view", "products.stock"])])} />);
    actions.moveRoleAction.mockResolvedValueOnce({ status: "forbidden" });
    await chooseMoveUp(user);
    expect(await menuOf().findByText("Your role can't do this anymore.")).toBeInTheDocument();
    expect(toastMock.toast).not.toHaveBeenCalled();
    actions.moveRoleAction.mockRejectedValueOnce(new Error("offline"));
    await chooseMoveUp(user);
    await waitFor(() => expect(toastMock.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" })));
  });
});

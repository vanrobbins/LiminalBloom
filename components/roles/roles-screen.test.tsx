import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ saveSwitchesAction: vi.fn(), moveRoleAction: vi.fn(), renameRoleAction: vi.fn(), resetRoleAction: vi.fn(), deleteRoleAction: vi.fn(), createRoleAction: vi.fn() }));
vi.mock("@/app/(app)/roles/actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toastMock);

import { RolesScreen } from "./roles-screen";
import { assistantManagerView, customRole, storeManagerView, viewFor } from "./test-view";

beforeEach(() => vi.clearAllMocks());

// jsdom applies no CSS, so the table and the phone folds are both in the page: look in the table.
const table = () => within(screen.getByRole("region", { name: "Permissions by role" }));
const cell = (permission: string, role: string) => table().getByRole("checkbox", { name: `${permission} for ${role}` });
const render_ = (view: ReturnType<typeof storeManagerView>) => render(<RolesScreen view={view} />);

describe("RolesScreen, what each viewer may change", () => {
  it("lets a Store Manager change every row below its own; its own row is read-only with the three locks", () => {
    render_(storeManagerView());
    expect(cell("Run sales", "Store Manager")).toBeDisabled();
    expect(table().getByRole("checkbox", { name: "Manage people for Store Manager, always on" })).toBeDisabled();
    expect(table().getByRole("checkbox", { name: "Manage people for Store Manager, always on" })).toBeChecked();
    for (const role of ["Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]) expect(cell("Run sales", role)).toBeEnabled();
    expect(table().getByText("Your role")).toBeInTheDocument();
    expect(screen.getByText("Every role can view the store: search products and see the map and published planograms.")).toBeInTheDocument();
    // The order the table runs in is explained where it shows, with its own ⓘ.
    expect(screen.getByText("Roles are listed from the highest rank down. A role can manage only roles ranked below it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What's rank?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What's permission?" })).toBeInTheDocument();
  });

  it("holds an Assistant Manager's own row and the Store Manager's read-only, and every Store settings cell off", () => {
    render_(assistantManagerView());
    expect(cell("Run sales", "Store Manager")).toBeDisabled();
    expect(cell("Run sales", "Assistant Manager")).toBeDisabled();
    expect(table().getByText("Above you")).toBeInTheDocument();
    expect(cell("Run sales", "Visual Merchandising Manager")).toBeEnabled();
    for (const role of ["Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]) expect(cell("Store settings", role)).toBeDisabled();
  });

  it("keeps a custom role that has roles.manage but not products.edit out of that column", () => {
    const view = viewFor(250, "editor", ["view", "roles.manage", "products.sale"], [customRole("editor", 250, ["view", "roles.manage", "products.sale"])]);
    render_(view);
    expect(cell("Edit products", "Visual Merchandising Worker")).toBeDisabled();
    expect(cell("Run sales", "Visual Merchandising Worker")).toBeEnabled();
  });

  it("lists the recent changes, or says there are none", () => {
    render_(storeManagerView([], { activity: [{ id: "1", text: "Van Robbins renamed Sales Associate to Educator", at: "2026-11-11T15:40:00.000Z" }] }));
    expect(screen.getByRole("heading", { name: "Recent changes" })).toBeInTheDocument();
    expect(screen.getByText(/Van Robbins renamed Sales Associate to Educator/)).toBeInTheDocument();
  });
});

describe("RolesScreen, staging and saving", () => {
  it("marks a changed role Unsaved, counts it, turns the menus and Add role off, and Discard puts it back", async () => {
    const user = userEvent.setup();
    render_(storeManagerView());
    await user.click(cell("Mark sold out", "Sales Associate"));
    expect(cell("Mark sold out", "Sales Associate")).not.toBeChecked();
    expect(table().getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getAllByText("1 role changed").length).toBeGreaterThan(0);
    expect(table().getByRole("button", { name: "More for Sales Associate" })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "Add role" })) expect(button).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await user.click(within(screen.getByRole("dialog", { name: "Discard your changes?" })).getByRole("button", { name: "Discard changes" }));
    expect(cell("Mark sold out", "Sales Associate")).toBeChecked();
    expect(screen.queryByRole("button", { name: "Review and save" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before Discard, and Cancel keeps the changes and gives focus back to Discard", async () => {
    const user = userEvent.setup();
    render_(storeManagerView());
    await user.click(cell("Mark sold out", "Sales Associate"));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = screen.getByRole("dialog", { name: "Discard your changes?" });
    expect(dialog).toHaveTextContent("1 role goes back to what is saved.");
    // Nothing is thrown away until the worded confirm.
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cell("Mark sold out", "Sales Associate")).not.toBeChecked();
    expect(screen.getAllByText("1 role changed").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Discard" })).toHaveFocus();
  });

  it("shows what changed in the review, saves the whole batch with the versions seen, and refreshes", async () => {
    const user = userEvent.setup();
    actions.saveSwitchesAction.mockResolvedValue({ status: "saved", roles: 2 });
    render_(storeManagerView());
    await user.click(cell("Mark sold out", "Sales Associate"));
    await user.click(cell("Edit the map", "Visual Merchandising Manager"));
    await user.click(screen.getByRole("button", { name: "Review and save" }));
    const dialog = within(screen.getByRole("dialog", { name: "Save changes to 2 roles?" }));
    expect(dialog.getByText("Everyone with these roles gets the change on their next tap. Nobody is signed out.")).toBeInTheDocument();
    expect(dialog.getByText("After saving, Sales Associate can:")).toBeInTheDocument();
    expect(dialog.getAllByText("No longer can:")).toHaveLength(2);
    await user.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(actions.saveSwitchesAction).toHaveBeenCalledTimes(1));
    const [edits] = actions.saveSwitchesAction.mock.calls[0];
    expect(edits.map((e: { roleId: string; version: number }) => [e.roleId, e.version])).toEqual([["vm_manager", 1], ["sales_associate", 1]]);
    expect(edits[1].switches).toEqual(["view"]);
    await waitFor(() => expect(toastMock.toast).toHaveBeenCalledWith({ tone: "success", title: "Saved changes to 2 roles" }));
    expect(routerMock.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Review and save" })).toBeNull();
  });

  it("says a role changed meanwhile, turns Save off, and on close reloads and drops the staged edits", async () => {
    const user = userEvent.setup();
    actions.saveSwitchesAction.mockResolvedValue({ status: "stale" });
    render_(storeManagerView());
    await user.click(cell("Mark sold out", "Sales Associate"));
    await user.click(screen.getByRole("button", { name: "Review and save" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("A role changed meanwhile, so nothing was saved. Close and look again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(routerMock.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Review and save" })).toBeNull();
  });

  it("names the role that blocks a change and holds back Review and save until it nests", async () => {
    const user = userEvent.setup();
    render_(storeManagerView());
    await user.click(cell("Store settings", "Visual Merchandising Manager"));
    expect(screen.getByText("Assistant Manager can't change store settings, so Visual Merchandising Manager can't either.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and save" })).toBeDisabled();
    await user.click(cell("Store settings", "Visual Merchandising Manager"));
    expect(screen.queryByRole("button", { name: "Review and save" })).toBeNull();
  });

  it("explains a cell in words as its title and description, and leaves it usable", async () => {
    render_(storeManagerView());
    const box = cell("Edit products", "Assistant Manager");
    expect(box).toBeEnabled();
    expect(box).toHaveAccessibleDescription("Visual Merchandising Manager can still edit products; turn it off there first.");
  });
});

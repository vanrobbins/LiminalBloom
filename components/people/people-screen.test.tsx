import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ changeRoleAction: vi.fn(), removePersonAction: vi.fn(), cancelInvitationAction: vi.fn() }));
vi.mock("@/app/(app)/store/people-actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toastMock);

import { PeopleScreen } from "./people-screen";
import { invitationRow, person, ROLES, viewOf } from "./test-view";

beforeEach(() => vi.clearAllMocks());

const sm = (extra = {}) => person("Sam Manager", "r-sm", "Store Manager", 100, extra);
const am = (extra = {}) => person("Ann Assistant", "r-am", "Assistant Manager", 200, extra);
const sa = (name: string, extra = {}) => person(name, "r-sa", "Sales Associate", 500, extra);

function renderScreen(view: ReturnType<typeof viewOf>) {
  return render(
    <>
      <h1>People</h1>
      <PeopleScreen view={view} storeName="Spring Street" />
    </>,
  );
}

describe("PeopleScreen, read-only", () => {
  it("shows role groups with counts, names, (you), and the read-only line; no buttons, no invitations, no addresses", () => {
    renderScreen(viewOf([sm(), am(), sa("Zoe Sales"), sa("Abe Me", { isYou: true })]));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Store Manager · 1", "Assistant Manager · 1", "Sales Associate · 2"]);
    const sales = screen.getByRole("heading", { name: "Sales Associate · 2" }).closest("section")!;
    expect(within(sales).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Abe Me (you)", "Zoe Sales"]);
    expect(screen.getByText(/Everyone in the store can see who's here/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change role|Remove|Cancel/ })).toBeNull();
    expect(screen.queryByText("Invitations waiting")).toBeNull();
    expect(document.body.textContent).not.toContain("@");
  });

  it("shows the only-you box", () => {
    renderScreen(viewOf([sm({ isYou: true })]));
    expect(screen.getByText("Only you so far.")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Invite someone");
  });
});

describe("PeopleScreen, for someone who manages people", () => {
  const managing = (people = [sm({ email: "sam@x.com" }), am({ email: "ann@x.com", isYou: true }), sa("Zoe Sales", { email: "zoe@x.com", canAct: true })], extra = {}) =>
    viewOf(people, { canManage: true, assignable: ROLES, ...extra });

  it("shows emails, no read-only line, and buttons only on rows that may be acted on, named in their labels", () => {
    renderScreen(managing());
    expect(screen.getByText("zoe@x.com")).toBeInTheDocument();
    expect(screen.queryByText(/Everyone in the store can see/)).toBeNull();
    expect(screen.getAllByRole("button", { name: /Change role for|Remove / }).map((b) => b.getAttribute("aria-label"))).toEqual(["Change role for Zoe Sales", "Remove Zoe Sales"]);
  });

  it("says a store always keeps one Store Manager, under the sole manager's own group only", () => {
    renderScreen(managing([sm({ isYou: true }), sa("Zoe Sales")], { isSoleManager: true }));
    expect(screen.getAllByText("A store always keeps one Store Manager.")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "What's store manager?" })).toBeInTheDocument();
  });

  it("changes a role: lists only the assignable roles, saves only a different one, says so without a toast, refreshes and refocuses the row's button", async () => {
    const user = userEvent.setup();
    actions.changeRoleAction.mockResolvedValue({ status: "changed", name: "Zoe Sales", roleName: "Visual Merchandising Worker" });
    const { rerender } = renderScreen(managing());
    await user.click(screen.getByRole("button", { name: "Change role for Zoe Sales" }));
    const dialog = screen.getByRole("dialog", { name: "Change Zoe Sales's role" });
    const select = within(dialog).getByRole("combobox", { name: /Role/ });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(ROLES.map((r) => r.name));
    expect(within(dialog).getByRole("button", { name: "Save role" })).toBeDisabled();
    await user.selectOptions(select, "r-vmw");
    await user.click(within(dialog).getByRole("button", { name: "Save role" }));
    expect(actions.changeRoleAction).toHaveBeenCalledWith("m-ZoeSales", "r-sa", "r-vmw");
    expect(toastMock.toast).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Changed Zoe Sales to Visual Merchandising Worker");
    expect(routerMock.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    // The reloaded list has Zoe in another group: her Change role button gets focus.
    rerender(
      <>
        <h1>People</h1>
        <PeopleScreen view={managing([sm({ email: "sam@x.com" }), person("Zoe Sales", "r-vmw", "Visual Merchandising Worker", 400, { canAct: true, email: "zoe@x.com" })])} storeName="Spring Street" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Change role for Zoe Sales" })).toHaveFocus();
  });

  it("removes: confirm copy, no toast, the row folds shut and then the list refreshes, focus on the page title", async () => {
    const user = userEvent.setup();
    actions.removePersonAction.mockResolvedValue({ status: "removed", name: "Zoe Sales" });
    renderScreen(managing());
    await user.click(screen.getByRole("button", { name: "Remove Zoe Sales" }));
    const dialog = screen.getByRole("dialog", { name: "Remove Zoe Sales?" });
    expect(within(dialog).getByText("They lose access to Spring Street at once. To bring them back, send a new invitation.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove from store" }));
    expect(actions.removePersonAction).toHaveBeenCalledWith("m-ZoeSales", "r-sa");
    expect(toastMock.toast).not.toHaveBeenCalled();
    // Folding, not gone: the refresh that drops the row waits for the fold.
    const row = screen.getByText("Zoe Sales").closest("li")!;
    expect(row).toHaveClass("grid-rows-[0fr]");
    expect(row).toHaveAttribute("inert");
    expect(screen.getByText("Ann Assistant").closest("li")).toHaveClass("grid-rows-[1fr]");
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Removed Zoe Sales");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
  });

  it("a removed row's neighbour gets focus (the next row's control, else the previous), not the page title", async () => {
    const user = userEvent.setup();
    const people = [sm({ email: "sam@x.com" }), sa("Abe Sales", { canAct: true }), sa("Zoe Sales", { canAct: true }), sa("Zed Sales", { canAct: true })];
    renderScreen(managing(people));
    const remove = async (name: string) => {
      actions.removePersonAction.mockResolvedValue({ status: "removed", name });
      await user.click(screen.getByRole("button", { name: `Remove ${name}` }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove from store" }));
    };
    await remove("Zoe Sales");
    await waitFor(() => expect(screen.getByRole("button", { name: "Change role for Zed Sales" })).toHaveFocus());
    await remove("Zed Sales");
    await waitFor(() => expect(screen.getByRole("button", { name: "Change role for Abe Sales" })).toHaveFocus());
  });

  it("the same role change twice in a row is announced twice", async () => {
    const user = userEvent.setup();
    actions.changeRoleAction.mockResolvedValue({ status: "changed", name: "Zoe Sales", roleName: "Visual Merchandising Worker" });
    renderScreen(managing());
    const change = async () => {
      await user.click(screen.getByRole("button", { name: "Change role for Zoe Sales" }));
      const dialog = screen.getByRole("dialog");
      await user.selectOptions(within(dialog).getByRole("combobox", { name: /Role/ }), "r-vmw");
      await user.click(within(dialog).getByRole("button", { name: "Save role" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    };
    await change();
    const first = screen.getByRole("status").textContent;
    await change();
    expect(screen.getByRole("status").textContent).not.toBe(first);
    expect(screen.getByRole("status")).toHaveTextContent("Changed Zoe Sales to Visual Merchandising Worker");
  });

  it("closing a remove dialog without removing puts focus back on its button", async () => {
    const user = userEvent.setup();
    renderScreen(managing());
    const button = screen.getByRole("button", { name: "Remove Zoe Sales" });
    await user.click(button);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(button).toHaveFocus());
    expect(actions.removePersonAction).not.toHaveBeenCalled();
  });

  it("shows the invitations card above the people when any are waiting", () => {
    renderScreen(managing(undefined, { invitations: [invitationRow("jane@x.com")] }));
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toBe("Invitations waiting");
  });
});

describe("PeopleScreen, only you", () => {
  it("tells someone who may invite to invite someone, and tells nobody else", () => {
    const { unmount } = renderScreen(viewOf([sm({ isYou: true })], { canManage: true, assignable: ROLES }));
    expect(screen.getByText("Only you so far.")).toBeInTheDocument();
    expect(screen.getByText("Invite someone to add them to the store.")).toBeInTheDocument();
    unmount();
    renderScreen(viewOf([sm({ isYou: true })], { canManage: true, assignable: [] }));
    expect(screen.queryByText("Invite someone to add them to the store.")).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ changeRoleAction: vi.fn() }));
vi.mock("@/app/(app)/people/actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

import { ChangeRoleDialog } from "./change-role-dialog";
import { person, ROLES } from "./test-view";

beforeEach(() => vi.clearAllMocks());

const jane = person("Jane Park", "r-sa", "Sales Associate", 500, { canAct: true });

async function chooseAndSave() {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<ChangeRoleDialog person={jane} roles={ROLES} onClose={onClose} onCloseAutoFocus={() => {}} />);
  await user.selectOptions(screen.getByRole("combobox", { name: /Role/ }), "r-vmw");
  await user.click(screen.getByRole("button", { name: "Save role" }));
  return { user, onClose };
}

describe("ChangeRoleDialog refusals", () => {
  it.each([
    ["stale", "Jane Park's role changed meanwhile. Close and look again."],
    ["gone", "Jane Park isn't in this store anymore. Close and look again."],
    ["forbidden", "Your role can't do this anymore."],
    ["invalid", "That role isn't available. Close and look again."],
  ] as const)("says %s in words, turns Save off for good, and reloads the list on close", async (status, message) => {
    actions.changeRoleAction.mockResolvedValue({ status });
    const { user, onClose } = await chooseAndSave();
    expect(await screen.findByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Save role" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(routerMock.refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(null);
  });

  it("says a store keeps one Store Manager, without disabling anything for good", async () => {
    actions.changeRoleAction.mockResolvedValue({ status: "last-manager" });
    await chooseAndSave();
    expect(await screen.findByRole("status")).toHaveTextContent("A store always keeps one Store Manager.");
    expect(screen.getByRole("button", { name: "Save role" })).toBeEnabled();
  });

  it("says so when the network fails", async () => {
    actions.changeRoleAction.mockRejectedValue(new Error("offline"));
    await chooseAndSave();
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't save. Check your connection and try again.");
  });

  it("starts with the current role chosen and Save off", () => {
    render(<ChangeRoleDialog person={jane} roles={ROLES} onClose={vi.fn()} onCloseAutoFocus={() => {}} />);
    expect(screen.getByRole("combobox", { name: /Role/ })).toHaveValue("r-sa");
    expect(screen.getByRole("button", { name: "Save role" })).toBeDisabled();
  });
});

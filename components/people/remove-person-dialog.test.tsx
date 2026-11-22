import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ removePersonAction: vi.fn() }));
vi.mock("@/app/(app)/store/people-actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

import { RemovePersonDialog } from "./remove-person-dialog";
import { person } from "./test-view";

beforeEach(() => vi.clearAllMocks());

const jane = person("Jane Park", "r-sa", "Sales Associate", 500, { canAct: true });

async function confirm() {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<RemovePersonDialog person={jane} storeName="Spring Street" onClose={onClose} onCloseAutoFocus={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Remove from store" }));
  return { user, onClose };
}

describe("RemovePersonDialog refusals", () => {
  it.each([
    ["gone", "Jane Park isn't in this store anymore. Close and look again."],
    ["stale", "Jane Park's role changed meanwhile. Close and look again."],
    ["forbidden", "Your role can't do this anymore."],
    ["last-manager", "A store always keeps one Store Manager."],
  ] as const)("says %s in words", async (status, message) => {
    actions.removePersonAction.mockResolvedValue({ status });
    await confirm();
    expect(await screen.findByRole("status")).toHaveTextContent(message);
  });

  it("turns the button off for good when the person is gone, and reloads the list on close", async () => {
    actions.removePersonAction.mockResolvedValue({ status: "gone" });
    const { user, onClose } = await confirm();
    await screen.findByRole("status");
    expect(screen.getByRole("button", { name: "Remove from store" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(routerMock.refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(null);
  });

  it("says so when the network fails", async () => {
    actions.removePersonAction.mockRejectedValue(new Error("offline"));
    await confirm();
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't save. Check your connection and try again.");
    expect(screen.getByRole("button", { name: "Remove from store" })).toBeEnabled();
  });
});

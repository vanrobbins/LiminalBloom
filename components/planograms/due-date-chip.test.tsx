import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setDue: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => ({ setDueDateAction: mocks.setDue }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { DueDateChip } from "./due-date-chip";

// The dialog is titled "Due date" too, so the field is found as the input.

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setDue.mockResolvedValue({ status: "saved", message: "Due date saved" });
});

describe("DueDateChip", () => {
  it("reads Set due date, and saves only on Save", async () => {
    const user = userEvent.setup();
    render(<DueDateChip fixtureId="f" dueDate={null} today="2026-10-10" />);
    await user.click(screen.getByRole("button", { name: "Set due date" }));
    const field = screen.getByLabelText("Due date", { selector: "input" });
    await user.type(field, "2026-10-14");
    await user.tab(); // blur saves nothing now
    expect(mocks.setDue).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.setDue).toHaveBeenCalledTimes(1);
    expect(mocks.setDue).toHaveBeenCalledWith("f", "2026-10-14");
  });

  it("shows the date and clears it", async () => {
    const user = userEvent.setup();
    render(<DueDateChip fixtureId="f" dueDate="2026-10-14" today="2026-10-10" />);
    await user.click(screen.getByRole("button", { name: "Due Oct 14" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(mocks.setDue).toHaveBeenCalledWith("f", null);
  });

  it("refuses a half-typed year", async () => {
    const user = userEvent.setup();
    render(<DueDateChip fixtureId="f" dueDate={null} today="2026-10-10" />);
    await user.click(screen.getByRole("button", { name: "Set due date" }));
    await user.type(screen.getByLabelText("Due date", { selector: "input" }), "0002-10-14");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Choose a date from 2000 on.")).toBeInTheDocument();
    expect(mocks.setDue).not.toHaveBeenCalled();
  });
});

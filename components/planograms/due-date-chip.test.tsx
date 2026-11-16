import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setDue: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => ({ setDueDateAction: mocks.setDue }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { DueDateChip } from "./due-date-chip";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setDue.mockResolvedValue({ status: "saved", message: "Due date saved" });
});

describe("DueDateChip", () => {
  it("reads Set due date, and saves a picked date at once: there is no Save button", async () => {
    const user = userEvent.setup();
    render(<DueDateChip canEdit fixtureId="f" dueDate={null} today="2026-10-10" />);
    await user.click(screen.getByRole("button", { name: "Set due date" }));
    // Titled for what it does, not the field's own label (B9): "Due date" finds only the field.
    expect(screen.getByRole("dialog", { name: "Set due date" })).toBeInTheDocument();
    const field = screen.getByLabelText("Due date");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    await user.type(field, "2026-10-14");
    await waitFor(() => expect(mocks.setDue).toHaveBeenCalledTimes(1));
    expect(mocks.setDue).toHaveBeenCalledWith("f", "2026-10-14");
    // Leaving the field afterwards sends nothing more.
    await user.tab();
    expect(mocks.setDue).toHaveBeenCalledTimes(1);
  });

  it("shows the date and clears it", async () => {
    const user = userEvent.setup();
    render(<DueDateChip canEdit fixtureId="f" dueDate="2026-10-14" today="2026-10-10" />);
    await user.click(screen.getByRole("button", { name: "Due Oct 14" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(mocks.setDue).toHaveBeenCalledWith("f", null);
  });

  it("refuses a half-typed year", async () => {
    const user = userEvent.setup();
    render(<DueDateChip canEdit fixtureId="f" dueDate={null} today="2026-10-10" />);
    await user.click(screen.getByRole("button", { name: "Set due date" }));
    await user.type(screen.getByLabelText("Due date"), "0002-10-14");
    await user.tab();
    expect(screen.getByText("Choose a date from 2000 on.")).toBeInTheDocument();
    expect(mocks.setDue).not.toHaveBeenCalled();
  });
});

describe("DueDateChip without planograms.publish", () => {
  it("shows a date that is set as plain text, with nothing to press", () => {
    render(<DueDateChip canEdit={false} fixtureId="f" dueDate="2026-10-14" today="2026-10-10" />);
    expect(screen.getByText("Due Oct 14")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows nothing when no date is set", () => {
    const { container } = render(<DueDateChip canEdit={false} fixtureId="f" dueDate={null} today="2026-10-10" />);
    expect(container).toBeEmptyDOMElement();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DueDateForm } from "./due-date-field";

const actions = vi.hoisted(() => ({ setDueDateAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

describe("DueDateForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    actions.setDueDateAction.mockResolvedValue({ status: "saved", message: "Due date saved" });
  });

  it("saves once, on Save only: typing and leaving the field save nothing", async () => {
    const onDone = vi.fn();
    render(<DueDateForm fixtureId="fx" dueDate={null} onDone={onDone} />);
    const field = screen.getByLabelText("Due date");
    // What a date field reports after the first digit of the year.
    fireEvent.change(field, { target: { value: "0002-10-15" } });
    fireEvent.change(field, { target: { value: "2026-10-15" } });
    fireEvent.blur(field);
    expect(actions.setDueDateAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(actions.setDueDateAction).toHaveBeenCalledTimes(1);
    expect(actions.setDueDateAction).toHaveBeenCalledWith("fx", "2026-10-15");
  });

  it("clears an existing date without saving the field", async () => {
    const onDone = vi.fn();
    render(<DueDateForm fixtureId="fx" dueDate="2026-10-01" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-10-20" } });
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(actions.setDueDateAction).toHaveBeenCalledTimes(1);
    expect(actions.setDueDateAction).toHaveBeenCalledWith("fx", null);
  });

  it("refuses an empty field and a year before 2000", async () => {
    render(<DueDateForm fixtureId="fx" dueDate={null} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Choose a date, or Clear.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "0002-10-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Choose a date from 2000 on.")).toBeInTheDocument();
    expect(actions.setDueDateAction).not.toHaveBeenCalled();
  });

  it("stays open when the server refuses", async () => {
    actions.setDueDateAction.mockResolvedValue({ status: "refused", message: "Not allowed" });
    const onDone = vi.fn();
    render(<DueDateForm fixtureId="fx" dueDate={null} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-10-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    expect(onDone).not.toHaveBeenCalled();
  });
});

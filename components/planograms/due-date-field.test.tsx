import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DueDateField } from "./due-date-field";

const actions = vi.hoisted(() => ({ setDueDateAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

describe("DueDateField", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    actions.setDueDateAction.mockResolvedValue({ status: "saved", message: "Due date saved" });
  });

  it("doesn't save while the date is being typed, and saves once on blur", async () => {
    render(<DueDateField fixtureId="fx" dueDate={null} />);
    const field = screen.getByLabelText("Due date");
    // What a date field reports after the first digit of the year.
    fireEvent.change(field, { target: { value: "0002-10-15" } });
    fireEvent.change(field, { target: { value: "2026-10-15" } });
    expect(actions.setDueDateAction).not.toHaveBeenCalled();
    fireEvent.blur(field);
    await waitFor(() => expect(actions.setDueDateAction).toHaveBeenCalledTimes(1));
    expect(actions.setDueDateAction).toHaveBeenCalledWith("fx", "2026-10-15");
    // Leaving again with nothing new saves nothing more.
    await waitFor(() => expect(field).toBeEnabled());
    fireEvent.blur(field);
    expect(actions.setDueDateAction).toHaveBeenCalledTimes(1);
  });

  it("saves on Enter", async () => {
    render(<DueDateField fixtureId="fx" dueDate="2026-10-01" />);
    const field = screen.getByLabelText("Due date");
    fireEvent.change(field, { target: { value: "2026-10-20" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(actions.setDueDateAction).toHaveBeenCalledWith("fx", "2026-10-20"));
  });

  it("refuses a year before 2000 instead of saving it", () => {
    render(<DueDateField fixtureId="fx" dueDate={null} />);
    const field = screen.getByLabelText("Due date");
    fireEvent.change(field, { target: { value: "0002-10-15" } });
    fireEvent.blur(field);
    expect(actions.setDueDateAction).not.toHaveBeenCalled();
    expect(screen.getByText("Choose a date from 2000 on.")).toBeInTheDocument();
  });
});

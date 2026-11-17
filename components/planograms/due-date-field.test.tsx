import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DueDateForm } from "./due-date-field";

const actions = vi.hoisted(() => ({ setDueDateAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/actions", () => actions);
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

const field = () => screen.getByLabelText("Due date");

describe("DueDateForm (auto-saves, R3)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    actions.setDueDateAction.mockResolvedValue({ status: "saved", message: "Due date saved" });
  });

  it("has no Save button", () => {
    render(<DueDateForm fixtureId="fx" dueDate={null} onDone={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("saves the moment a date is picked, once, closes, and does not toast (the chip is the result)", async () => {
    const onDone = vi.fn();
    render(<DueDateForm fixtureId="fx" dueDate={null} onDone={onDone} />);
    // What a date field reports after the first digit of the year: not a date yet.
    fireEvent.change(field(), { target: { value: "0002-10-15" } });
    expect(actions.setDueDateAction).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: "2026-10-15" } });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(actions.setDueDateAction).toHaveBeenCalledTimes(1);
    expect(actions.setDueDateAction).toHaveBeenCalledWith("fx", "2026-10-15");
    expect(refresh).toHaveBeenCalled();
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("clears an existing date with Clear, at once", async () => {
    const onDone = vi.fn();
    render(<DueDateForm fixtureId="fx" dueDate="2026-10-01" onDone={onDone} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear due date" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(actions.setDueDateAction).toHaveBeenCalledTimes(1);
    expect(actions.setDueDateAction).toHaveBeenCalledWith("fx", null);
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("sends nothing to put back the date it already has", async () => {
    actions.setDueDateAction.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    render(<DueDateForm fixtureId="fx" dueDate="2026-10-01" onDone={vi.fn()} />);
    fireEvent.change(field(), { target: { value: "2026-10-05" } });
    await waitFor(() => expect(actions.setDueDateAction).toHaveBeenCalledTimes(1));
    await screen.findByText("Couldn't save");
    fireEvent.change(field(), { target: { value: "2026-10-01" } });
    expect(actions.setDueDateAction).toHaveBeenCalledTimes(1);
  });

  it("tells an invalid year on leaving the field, and saves once a real date follows", async () => {
    render(<DueDateForm fixtureId="fx" dueDate="2026-10-01" onDone={vi.fn()} />);
    fireEvent.change(field(), { target: { value: "0002-10-15" } });
    expect(screen.queryByText("Choose a date from 2000 on.")).toBeNull();
    fireEvent.blur(field());
    expect(screen.getByText("Choose a date from 2000 on.")).toBeInTheDocument();
    expect(actions.setDueDateAction).not.toHaveBeenCalled();
    // A real date clears the message and saves.
    fireEvent.change(field(), { target: { value: "2026-11-02" } });
    expect(screen.queryByText("Choose a date from 2000 on.")).toBeNull();
    await waitFor(() => expect(actions.setDueDateAction).toHaveBeenCalledWith("fx", "2026-11-02"));
  });

  it("tells an emptied field on leaving it, when a date was set, and sends nothing", () => {
    render(<DueDateForm fixtureId="fx" dueDate="2026-10-01" onDone={vi.fn()} />);
    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.blur(field());
    expect(screen.getByText("Choose a date, or Clear.")).toBeInTheDocument();
    expect(actions.setDueDateAction).not.toHaveBeenCalled();
  });

  it("keeps focus in the field while the save is out (read-only, not disabled), and ignores a second pick", async () => {
    let finish: (reply: unknown) => void = () => {};
    actions.setDueDateAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<DueDateForm fixtureId="fx" dueDate={null} onDone={vi.fn()} />);
    field().focus();
    fireEvent.change(field(), { target: { value: "2026-10-15" } });
    await waitFor(() => expect(field()).toHaveAttribute("readonly"));
    expect(field()).toBeEnabled();
    expect(field()).toHaveFocus();
    fireEvent.change(field(), { target: { value: "2026-10-16" } });
    expect(actions.setDueDateAction).toHaveBeenCalledTimes(1);
    expect(field()).toHaveValue("2026-10-15");
    finish({ status: "refused", message: "Changed on another device" });
    await screen.findByText("Changed on another device");
    expect(field()).not.toHaveAttribute("readonly");
    expect(field()).toHaveFocus();
  });

  it("keeps focus on Clear while it saves (aria-disabled, not disabled), and a second press sends nothing", async () => {
    let finish: (reply: unknown) => void = () => {};
    actions.setDueDateAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<DueDateForm fixtureId="fx" dueDate="2026-10-01" onDone={vi.fn()} />);
    const clear = screen.getByRole("button", { name: "Clear due date" });
    await userEvent.click(clear);
    expect(clear).toHaveFocus();
    expect(clear).toBeEnabled();
    expect(clear).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(clear);
    expect(actions.setDueDateAction).toHaveBeenCalledTimes(1);
    finish({ status: "refused", message: "Changed on another device" });
    await screen.findByText("Couldn't save");
    expect(clear).toHaveFocus();
    expect(clear).not.toHaveAttribute("aria-disabled");
  });

  it("stays open and says why, under the field and beside it, when the server refuses; no toast", async () => {
    actions.setDueDateAction.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const onDone = vi.fn();
    render(<DueDateForm fixtureId="fx" dueDate={null} onDone={onDone} />);
    fireEvent.change(field(), { target: { value: "2026-10-15" } });
    expect(await screen.findByText("Changed on another device")).toBeInTheDocument();
    expect(screen.getByText("Couldn't save")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("a lost connection is a toast, and the form stays open to try again", async () => {
    actions.setDueDateAction.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const onDone = vi.fn();
    render(<DueDateForm fixtureId="fx" dueDate={null} onDone={onDone} />);
    fireEvent.change(field(), { target: { value: "2026-10-15" } });
    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't save the due date" })));
    expect(onDone).not.toHaveBeenCalled();
    expect(field()).toBeEnabled();
  });
});

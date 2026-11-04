import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ changeStatus: vi.fn() }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/app/(app)/products/status-actions", () => actions);
vi.mock("@/lib/toast", () => toasts);

import type { ProductRow } from "@/lib/products/queries";

import { StatusControl } from "./status-control";

const product: ProductRow = { id: "p1", name: "High-Rise Pant", styleNumber: "HRP-01", color: "Black", sizeRange: "", status: "in_stock", version: 3, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid" };

beforeEach(() => vi.clearAllMocks());

describe("StatusControl", () => {
  it("saves a new status at once and offers Undo", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "saved", version: 4 });
    const onChanged = vi.fn();
    render(<StatusControl product={product} onChanged={onChanged} />);
    expect(screen.getByRole("radio", { name: "In stock" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(actions.changeStatus).toHaveBeenCalledWith("p1", 3, "sold_out");
    expect(onChanged).toHaveBeenCalledWith({ ...product, status: "sold_out", version: 4 });
    const shown = toasts.toast.mock.calls[0][0];
    expect(shown.title).toBe("High-Rise Pant: Sold out");
    actions.changeStatus.mockResolvedValue({ status: "saved", version: 5 });
    await shown.action.onSelect();
    expect(actions.changeStatus).toHaveBeenLastCalledWith("p1", 4, "in_stock");
  });

  it("takes the other device's value when it saved first", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "conflict", product: { ...product, status: "on_sale", version: 9 } });
    const onChanged = vi.fn();
    render(<StatusControl product={product} onChanged={onChanged} />);
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(onChanged).toHaveBeenCalledWith({ ...product, status: "on_sale", version: 9 });
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Changed on another device" }));
  });

  it("says so and frees the control when the save fails", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockRejectedValue(new Error("offline"));
    render(<StatusControl product={product} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't save the status" }));
    expect(screen.getByRole("radio", { name: "Sold out" })).toBeEnabled();
  });

  it("moves between the choices with the arrow keys without saving; Space chooses (P3.5)", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "saved", version: 4 });
    render(<StatusControl product={product} onChanged={vi.fn()} />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "In stock" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Sold out" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "On sale" })).toHaveFocus();
    expect(actions.changeStatus).not.toHaveBeenCalled();
    await user.keyboard(" ");
    expect(actions.changeStatus).toHaveBeenCalledWith("p1", 3, "on_sale");
  });

  it("keeps focus on the choice while a save is pending", async () => {
    const user = userEvent.setup();
    let finish: (value: { status: "saved"; version: number }) => void = () => {};
    actions.changeStatus.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<StatusControl product={product} onChanged={vi.fn()} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    const soldOut = screen.getByRole("radio", { name: "Sold out" });
    await user.keyboard(" ");
    expect(soldOut).toHaveFocus();
    expect(soldOut).toHaveAttribute("aria-disabled", "true");
    expect(soldOut).not.toBeDisabled();
    await user.keyboard(" ");
    expect(actions.changeStatus).toHaveBeenCalledTimes(1);
    finish({ status: "saved", version: 4 });
  });

  it("puts only the checked choice in the Tab order", () => {
    render(<StatusControl product={product} onChanged={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "In stock" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Sold out" })).toHaveAttribute("tabindex", "-1");
  });
});

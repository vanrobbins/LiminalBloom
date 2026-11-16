import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ changeStatus: vi.fn() }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/app/(app)/products/status-actions", () => actions);
vi.mock("@/lib/toast", () => toasts);

import type { ProductRow } from "@/lib/products/queries";

import { EVERYTHING } from "@/lib/access/test-guard";
import { StatusControl } from "./status-control";

const product: ProductRow = { id: "p1", name: "High-Rise Pant", styleNumber: "HRP-01", color: "Black", sizeRange: "", status: "in_stock", version: 3, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid" };

beforeEach(() => vi.clearAllMocks());

/** The check that cross-fades in on the chosen radio (the status icon fades out as it comes). */
const checkOf = (name: string) => screen.getByRole("radio", { name }).querySelector("[data-check]");

describe("StatusControl", () => {
  it("saves a new status at once: the chosen radio shows a check, no toast", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "saved", version: 4 });
    const onChanged = vi.fn();
    const { rerender } = render(<StatusControl member={EVERYTHING} product={product} onChanged={onChanged} />);
    expect(screen.getByRole("radio", { name: "In stock" })).toBeChecked();
    expect(checkOf("In stock")).toHaveClass("opacity-100");
    expect(checkOf("Sold out")).toHaveClass("opacity-0");
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(actions.changeStatus).toHaveBeenCalledWith("p1", 3, "sold_out");
    expect(onChanged).toHaveBeenCalledWith({ ...product, status: "sold_out", version: 4 });
    expect(toasts.toast).not.toHaveBeenCalled();
    rerender(<StatusControl member={EVERYTHING} product={{ ...product, status: "sold_out", version: 4 }} onChanged={onChanged} />);
    expect(checkOf("Sold out")).toHaveClass("opacity-100");
    expect(checkOf("In stock")).toHaveClass("opacity-0");
  });

  it("re-picking the previous status is the undo: it saves against the new version", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "saved", version: 5 });
    render(<StatusControl member={EVERYTHING} product={{ ...product, status: "sold_out", version: 4 }} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "In stock" }));
    expect(actions.changeStatus).toHaveBeenCalledWith("p1", 4, "in_stock");
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("takes the other device's value when it saved first, and says so under the radios", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "conflict", product: { ...product, status: "on_sale", version: 9 } });
    const onChanged = vi.fn();
    render(<StatusControl member={EVERYTHING} product={product} onChanged={onChanged} />);
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(onChanged).toHaveBeenCalledWith({ ...product, status: "on_sale", version: 9 });
    expect(screen.getByRole("status")).toHaveTextContent("Changed on another device. The current status is shown.");
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("tapping the status it already has saves nothing", async () => {
    const user = userEvent.setup();
    render(<StatusControl member={EVERYTHING} product={product} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "In stock" }));
    expect(actions.changeStatus).not.toHaveBeenCalled();
  });

  it("a refusal is cleared by the next choice that saves", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValueOnce({ status: "forbidden" });
    render(<StatusControl member={EVERYTHING} product={product} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(screen.getByRole("status")).toHaveTextContent("Your role can't make that change. The status was not changed.");
    actions.changeStatus.mockResolvedValueOnce({ status: "saved", version: 4 });
    await user.click(screen.getByRole("radio", { name: "On sale" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("a lost connection stays a toast, and frees the control", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockRejectedValue(new Error("offline"));
    render(<StatusControl member={EVERYTHING} product={product} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't save the status" }));
    expect(screen.getByRole("radio", { name: "Sold out" })).toBeEnabled();
  });

  it("moves between the choices with the arrow keys without saving; Space chooses (P3.5)", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "saved", version: 4 });
    render(<StatusControl member={EVERYTHING} product={product} onChanged={vi.fn()} />);
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
    render(<StatusControl member={EVERYTHING} product={product} onChanged={vi.fn()} />);
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
    render(<StatusControl member={EVERYTHING} product={product} onChanged={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "In stock" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Sold out" })).toHaveAttribute("tabindex", "-1");
  });
});

// A Sales Associate holds products.stock and not products.sale (spec 0.7 §4.2).
const salesAssociate = { switches: ["view", "products.stock"] as const };

describe("StatusControl for a role that can mark sold out but not run sales", () => {
  it("offers In stock and Sold out, never On sale", () => {
    render(<StatusControl member={salesAssociate} product={product} onChanged={vi.fn()} />);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["In stock", "Sold out"]);
  });

  it("on a product on sale, offers only Sold out beside the current status", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "saved", version: 4 });
    render(<StatusControl member={salesAssociate} product={{ ...product, status: "on_sale" }} onChanged={vi.fn()} />);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Sold out", "On sale"]);
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it("shows only the status, with nothing to press, for a role that can change neither", () => {
    render(<StatusControl member={{ switches: ["view"] }} product={product} onChanged={vi.fn()} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByText("In stock")).toBeInTheDocument();
  });

  it("says so under the radios, and changes nothing on screen, when the server refuses", async () => {
    const user = userEvent.setup();
    actions.changeStatus.mockResolvedValue({ status: "forbidden" });
    const onChanged = vi.fn();
    render(<StatusControl member={salesAssociate} product={product} onChanged={onChanged} />);
    await user.click(screen.getByRole("radio", { name: "Sold out" }));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Your role can't make that change. The status was not changed.");
    expect(toasts.toast).not.toHaveBeenCalled();
  });
});

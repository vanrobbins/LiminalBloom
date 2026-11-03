import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ removeProduct: vi.fn() }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(app)/products/actions", () => actions);
vi.mock("@/lib/toast", () => toasts);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { SearchCardMenu } from "./search-card-menu";

beforeEach(() => vi.clearAllMocks());

describe("SearchCardMenu", () => {
  it("links Edit to the product page", async () => {
    const user = userEvent.setup();
    render(<SearchCardMenu productId="p1" version={3} name="Pant" onDeleted={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "More for Pant" }));
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute("href", "/products/p1");
  });

  it("deletes after the confirm, with the version, and keeps the list instead of navigating", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    actions.removeProduct.mockResolvedValue({ status: "saved" });
    render(<SearchCardMenu productId="p1" version={3} name="Pant" onDeleted={onDeleted} />);
    await user.click(screen.getByRole("button", { name: "More for Pant" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));
    expect(actions.removeProduct).toHaveBeenCalledWith("p1", 3);
    expect(onDeleted).toHaveBeenCalledWith("p1");
    expect(router.push).not.toHaveBeenCalled();
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Deleted Pant" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves the card when the product changed on another device", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    actions.removeProduct.mockResolvedValue({ status: "conflict" });
    render(<SearchCardMenu productId="p1" version={3} name="Pant" onDeleted={onDeleted} />);
    await user.click(screen.getByRole("button", { name: "More for Pant" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });
});

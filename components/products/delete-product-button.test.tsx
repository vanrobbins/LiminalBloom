import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ removeProduct: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/app/(app)/products/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/toast", () => toasts);

import { DeleteProductButton } from "./delete-product-button";

beforeEach(() => vi.clearAllMocks());

describe("DeleteProductButton", () => {
  it("opens confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<DeleteProductButton productId="p1" version={1} name="High-Rise Pant" />);
    await user.click(screen.getByRole("button", { name: "Delete product" }));
    expect(screen.getByRole("dialog", { name: /Delete High-Rise Pant/ })).toBeInTheDocument();
  });

  describe("loading state", () => {
    it("disables button while deleting", async () => {
      const user = userEvent.setup();
      let resolveFn: () => void;
      actions.removeProduct.mockReturnValue(new Promise((resolve) => { resolveFn = () => resolve({ status: "saved" }); }));
      render(<DeleteProductButton productId="p1" version={1} name="Shorts" />);

      await user.click(screen.getByRole("button", { name: "Delete product" }));
      const deleteBtn = within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" });
      await user.click(deleteBtn);

      expect(deleteBtn).toBeDisabled();
      resolveFn!();
      await vi.waitFor(() => expect(deleteBtn).not.toBeDisabled());
    });
  });

  describe("success flow", () => {
    it("shows success toast and navigates on successful delete", async () => {
      const user = userEvent.setup();
      actions.removeProduct.mockResolvedValueOnce({ status: "saved" });
      render(<DeleteProductButton productId="p1" version={1} name="Jacket" />);

      await user.click(screen.getByRole("button", { name: "Delete product" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));

      expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "success", title: "Deleted Jacket" }));
      expect(router.push).toHaveBeenCalledWith("/products");
    });

    it("navigates to products page on successful delete", async () => {
      const user = userEvent.setup();
      actions.removeProduct.mockResolvedValueOnce({ status: "saved" });
      render(<DeleteProductButton productId="p1" version={1} name="Vest" />);

      await user.click(screen.getByRole("button", { name: "Delete product" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));

      await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/products"));
    });
  });

  describe("error handling", () => {
    it("shows error toast when the delete throws", async () => {
      const user = userEvent.setup();
      actions.removeProduct.mockRejectedValueOnce(new Error("offline"));
      render(<DeleteProductButton productId="p1" version={1} name="Pant" />);

      await user.click(screen.getByRole("button", { name: "Delete product" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));

      expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't delete" }));
      expect(router.push).not.toHaveBeenCalled();
    });

    it("keeps dialog open and button enabled after error", async () => {
      const user = userEvent.setup();
      actions.removeProduct.mockRejectedValueOnce(new Error("offline"));
      render(<DeleteProductButton productId="p1" version={1} name="Pant" />);

      await user.click(screen.getByRole("button", { name: "Delete product" }));
      const deleteBtn = within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" });
      await user.click(deleteBtn);

      await vi.waitFor(() => expect(deleteBtn).toBeEnabled());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows conflict toast and refreshes on version conflict", async () => {
      const user = userEvent.setup();
      actions.removeProduct.mockResolvedValueOnce({ status: "conflict" });
      render(<DeleteProductButton productId="p1" version={1} name="Shoes" />);

      await user.click(screen.getByRole("button", { name: "Delete product" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));

      expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Changed on another device" }));
      expect(router.refresh).toHaveBeenCalled();
      await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("does not navigate on version conflict", async () => {
      const user = userEvent.setup();
      actions.removeProduct.mockResolvedValueOnce({ status: "conflict" });
      render(<DeleteProductButton productId="p1" version={1} name="Hat" />);

      await user.click(screen.getByRole("button", { name: "Delete product" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));

      expect(router.push).not.toHaveBeenCalled();
    });
  });
});

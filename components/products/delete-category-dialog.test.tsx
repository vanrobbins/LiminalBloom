import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ removeCategory: vi.fn(), saveCategory: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/app/(app)/products/categories/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { CategoryRow } from "@/lib/products/queries";

import { DeleteCategoryDialog } from "./delete-category-dialog";

const denim = (productCount: number): CategoryRow => ({ id: "c1", name: "Denim", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 8, version: 4, productCount });

beforeEach(() => vi.clearAllMocks());

describe("DeleteCategoryDialog", () => {
  it("says how many products go with the category", () => {
    render(<DeleteCategoryDialog category={denim(12)} open onOpenChange={() => {}} onDeleted={() => {}} />);
    expect(screen.getByText("This also deletes its 12 products, with their locations and images. This can't be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete category and 12 products" })).toBeInTheDocument();
  });

  it("is a plain question for an empty category", () => {
    render(<DeleteCategoryDialog category={denim(0)} open onOpenChange={() => {}} onDeleted={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Delete Denim?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete category" })).toBeInTheDocument();
  });

  it("sends the count it showed, and shows the new count if it changed", async () => {
    const user = userEvent.setup();
    actions.removeCategory.mockResolvedValue({ status: "count-changed", count: 13 });
    const onDeleted = vi.fn();
    render(<DeleteCategoryDialog category={denim(12)} open onOpenChange={() => {}} onDeleted={onDeleted} />);
    await user.click(screen.getByRole("button", { name: "Delete category and 12 products" }));
    expect(actions.removeCategory).toHaveBeenCalledWith("c1", 4, 12);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete category and 13 products" })).toBeInTheDocument();
    expect(screen.getByText("Someone added or removed products meanwhile. Check the new count.")).toBeInTheDocument();
  });

  it("uses one product, not one products", () => {
    render(<DeleteCategoryDialog category={denim(1)} open onOpenChange={() => {}} onDeleted={() => {}} />);
    expect(screen.getByRole("button", { name: "Delete category and 1 product" })).toBeInTheDocument();
  });

  it("shows a message and frees the button when the call fails", async () => {
    const user = userEvent.setup();
    actions.removeCategory.mockRejectedValue(new Error("network"));
    const onDeleted = vi.fn();
    render(<DeleteCategoryDialog category={denim(2)} open onOpenChange={() => {}} onDeleted={onDeleted} />);
    await user.click(screen.getByRole("button", { name: "Delete category and 2 products" }));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't delete this category. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete category and 2 products" })).toBeEnabled();
  });

  it("after another device's change, stops the delete and reloads the list on close", async () => {
    const user = userEvent.setup();
    actions.removeCategory.mockResolvedValue({ status: "conflict" });
    const onOpenChange = vi.fn();
    render(<DeleteCategoryDialog category={denim(2)} open onOpenChange={onOpenChange} onDeleted={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Delete category and 2 products" }));
    expect(screen.getByText("This category changed on another device. Close and look again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete category and 2 products" })).toBeDisabled();
    expect(router.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(router.refresh).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("doesn't reload on close when nothing went wrong", async () => {
    const user = userEvent.setup();
    render(<DeleteCategoryDialog category={denim(2)} open onOpenChange={() => {}} onDeleted={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

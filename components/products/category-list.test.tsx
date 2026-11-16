import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ removeCategory: vi.fn(), saveCategory: vi.fn() }));
vi.mock("@/app/(app)/products/categories/actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toastMock);

import type { CategoryRow } from "@/lib/products/queries";
import { CategoryList } from "./category-list";

beforeEach(() => vi.clearAllMocks());

const mockCategory = (overrides?: Partial<CategoryRow>): CategoryRow => ({
  id: "cat-1",
  name: "Pants",
  version: 1,
  hungColumns: 2,
  hungRows: 3,
  foldedColumns: 4,
  foldedRows: 2, sizeRange: "",
  productCount: 5,
  ...overrides,
});

describe("CategoryList", () => {
  describe("empty state", () => {
    it("shows message when there are no categories", () => {
      render(<CategoryList categories={[]} />);
      expect(screen.getByText("No categories yet.")).toBeInTheDocument();
    });
  });

  describe("rendering", () => {
    it("displays all categories with their counts and defaults", () => {
      const categories = [
        mockCategory({ name: "Pants", productCount: 5 }),
        mockCategory({ id: "cat-2", name: "Shirts", productCount: 12 }),
      ];
      render(<CategoryList categories={categories} />);

      expect(screen.getByText("Pants")).toBeInTheDocument();
      expect(screen.getByText("Shirts")).toBeInTheDocument();
      expect(screen.getByText(/5\s+products/)).toBeInTheDocument();
      expect(screen.getByText(/12\s+products/)).toBeInTheDocument();
    });

    it("shows singular 'product' for count of 1", () => {
      render(<CategoryList categories={[mockCategory({ productCount: 1 })]} />);
      expect(screen.getByText(/1\s+product(?!s)/)).toBeInTheDocument();
    });

    it("shows defaults description including grid dimensions", () => {
      render(<CategoryList categories={[mockCategory({ hungRows: 3, foldedRows: 2, sizeRange: "" }), mockCategory({ id: "cat-2", hungRows: 4, foldedRows: 1, sizeRange: "" })]} />);
      expect(screen.getByText(/Hung.*1.*3/)).toBeInTheDocument();
      expect(screen.getByText(/Folded.*2.*2/)).toBeInTheDocument();
      expect(screen.getByText(/Hung.*1.*4/)).toBeInTheDocument();
      expect(screen.getByText(/Folded.*2.*1/)).toBeInTheDocument();
    });
  });

  describe("add category dialog", () => {
    it("opens add dialog and closes on cancel", async () => {
      const user = userEvent.setup();
      render(<CategoryList categories={[]} />);

      await user.click(screen.getByRole("button", { name: "Add category" }));
      expect(screen.getByRole("dialog", { name: "New category" })).toBeInTheDocument();

      const dialog = screen.getByRole("dialog", { name: "New category" });
      const closeBtn = within(dialog).getByRole("button", { name: "Close" });
      await user.click(closeBtn);
      expect(screen.queryByRole("dialog", { name: "New category" })).not.toBeInTheDocument();
    });

    it("closes dialog after successful add", async () => {
      const user = userEvent.setup();
      actions.saveCategory.mockResolvedValueOnce({ status: "saved" });
      render(<CategoryList categories={[]} />);

      await user.click(screen.getByRole("button", { name: "Add category" }));
      await user.type(screen.getByLabelText("Name"), "Denim");
      await user.click(within(screen.getByRole("dialog", { name: "New category" })).getByRole("button", { name: "Add category" }));

      expect(screen.queryByRole("dialog", { name: "New category" })).not.toBeInTheDocument();
    });
  });

  describe("edit category dialog", () => {
    it("closes edit dialog on cancel", async () => {
      const user = userEvent.setup();
      render(<CategoryList categories={[mockCategory({ name: "Accessories" })]} />);

      await user.click(screen.getByLabelText("Edit Accessories"));
      const dialog = screen.getByRole("dialog", { name: "Edit Accessories" });
      const closeBtn = within(dialog).getByRole("button", { name: "Close" });
      await user.click(closeBtn);
      expect(screen.queryByRole("dialog", { name: /Edit/ })).not.toBeInTheDocument();
    });

    it("opens edit dialog with form and current name", async () => {
      const user = userEvent.setup();
      render(<CategoryList categories={[mockCategory({ name: "Socks" })]} />);

      await user.click(screen.getByLabelText("Edit Socks"));
      const dialog = screen.getByRole("dialog", { name: "Edit Socks" });

      // Dialog opens with form showing the current name
      expect(within(dialog).getByLabelText("Name")).toHaveValue("Socks");
    });
  });

  describe("delete category dialog", () => {
    it("closes delete dialog on cancel", async () => {
      const user = userEvent.setup();
      render(<CategoryList categories={[mockCategory({ name: "Gloves", productCount: 1 })]} />);

      await user.click(screen.getByLabelText("Delete Gloves"));
      const dialog = screen.getByRole("dialog", { name: /Delete Gloves/ });
      const closeBtn = within(dialog).getByRole("button", { name: "Close" });
      await user.click(closeBtn);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders delete category dialog when delete button clicked", async () => {
      const user = userEvent.setup();
      render(<CategoryList categories={[mockCategory({ id: "cat-1", name: "Scarves", productCount: 3 })]} />);

      await user.click(screen.getByLabelText("Delete Scarves"));

      const dialog = screen.getByRole("dialog", { name: /Delete Scarves/ });
      expect(dialog).toBeInTheDocument();
      // Dialog should show the delete button with product count
      expect(within(dialog).getByRole("button", { name: /Delete category and 3 products/ })).toBeInTheDocument();
    });

    it("a deleted category's row folds shut with no toast, then the list reloads and the dialog is closed", async () => {
      const user = userEvent.setup();
      actions.removeCategory.mockResolvedValueOnce({ status: "deleted" });
      render(<CategoryList categories={[mockCategory({ id: "cat-1", name: "Scarves", productCount: 3 }), mockCategory({ id: "cat-2", name: "Hats" })]} />);

      await user.click(screen.getByLabelText("Delete Scarves"));
      const dialog = screen.getByRole("dialog", { name: /Delete Scarves/ });
      await user.click(within(dialog).getByRole("button", { name: /Delete category and 3 products/ }));

      expect(toastMock.toast).not.toHaveBeenCalled();
      const row = screen.getByText("Scarves").closest("li")!;
      expect(row).toHaveClass("grid-rows-[0fr]");
      expect(row).toHaveAttribute("inert");
      expect(screen.getByText("Hats").closest("li")).toHaveClass("grid-rows-[1fr]");
      expect(routerMock.refresh).not.toHaveBeenCalled();
      await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
      expect(screen.queryByRole("dialog", { name: /Delete Scarves/ })).not.toBeInTheDocument();
    });

    it("says the deletion in a live region, and focus goes to the next row's control (else the previous) instead of dropping to the page", async () => {
      const user = userEvent.setup();
      actions.removeCategory.mockResolvedValue({ status: "deleted" });
      render(<CategoryList categories={[mockCategory({ id: "cat-1", name: "Scarves", productCount: 0 }), mockCategory({ id: "cat-2", name: "Hats", productCount: 0 }), mockCategory({ id: "cat-3", name: "Belts", productCount: 0 })]} />);
      await user.click(screen.getByLabelText("Delete Hats"));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Delete category/ }));
      expect(screen.getByRole("status")).toHaveTextContent("Deleted Hats");
      await waitFor(() => expect(screen.getByLabelText("Edit Belts")).toHaveFocus());
      await user.click(screen.getByLabelText("Delete Belts"));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Delete category/ }));
      await waitFor(() => expect(screen.getByLabelText("Edit Scarves")).toHaveFocus());
    });

    it("when the reload fails after the fold, the row opens again with the failure on it", async () => {
      const user = userEvent.setup();
      actions.removeCategory.mockResolvedValue({ status: "deleted" });
      routerMock.refresh.mockImplementationOnce(() => {
        throw new Error("refresh failed");
      });
      render(<CategoryList categories={[mockCategory({ id: "cat-1", name: "Scarves", productCount: 0 }), mockCategory({ id: "cat-2", name: "Hats" })]} />);
      await user.click(screen.getByLabelText("Delete Scarves"));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Delete category/ }));
      const row = screen.getByText("Scarves").closest("li")!;
      await waitFor(() => expect(within(row).getByText("Deleted, but the list didn't reload. Reload the page.")).toBeInTheDocument());
      expect(row).toHaveClass("grid-rows-[1fr]");
      expect(row).not.toHaveAttribute("inert");
    });
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ removeCategory: vi.fn(), saveCategory: vi.fn() }));
vi.mock("@/app/(app)/products/categories/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { CategoryForm } from "./category-form";

describe("CategoryForm", () => {
  it("saves a new category with its default space and size range", async () => {
    const user = userEvent.setup();
    actions.saveCategory.mockResolvedValue({ status: "saved" });
    const onDone = vi.fn();
    render(<CategoryForm onDone={onDone} />);
    await user.type(screen.getByLabelText("Name"), "Denim");
    await user.click(screen.getByRole("button", { name: "24–34" }));
    await user.click(screen.getByRole("button", { name: "Add category" }));
    expect(actions.saveCategory).toHaveBeenCalledWith(null, null, { name: "Denim", hungColumns: 2, hungRows: 3, foldedColumns: 4, foldedRows: 2, sizeRange: "24–34" });
    expect(onDone).toHaveBeenCalled();
  });

  it("shows space in plain words with a drawing that follows the steppers", async () => {
    const user = userEvent.setup();
    render(<CategoryForm onDone={() => {}} />);
    expect(screen.getByText("Hung: 1 ft wide, 3 rows high")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More hung width" }));
    expect(screen.getByText("Hung: 1½ ft wide, 3 rows high")).toBeInTheDocument();
    expect(document.querySelector("[data-space-drawing] svg")).toHaveAttribute("data-columns", "3");
    expect(screen.queryByText(/stack/i)).toBeNull();
  });

  it("lets a quick pick fill the size range, which stays editable", async () => {
    const user = userEvent.setup();
    render(<CategoryForm onDone={() => {}} />);
    await user.click(screen.getByRole("button", { name: "XS–XL" }));
    const input = screen.getByLabelText("Size range");
    expect(input).toHaveValue("XS–XL");
    await user.type(input, "L");
    expect(input).toHaveValue("XS–XLL");
  });

  it("shows a duplicate name beside the field", async () => {
    const user = userEvent.setup();
    actions.saveCategory.mockResolvedValue({ status: "invalid", errors: { name: "There is already a category with that name." } });
    render(<CategoryForm onDone={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "Denim");
    await user.click(screen.getByRole("button", { name: "Add category" }));
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("There is already a category with that name.");
  });

  it("shows a message and frees the button when the call fails", async () => {
    const user = userEvent.setup();
    actions.saveCategory.mockRejectedValue(new Error("network"));
    const onDone = vi.fn();
    render(<CategoryForm onDone={onDone} />);
    await user.type(screen.getByLabelText("Name"), "Denim");
    await user.click(screen.getByRole("button", { name: "Add category" }));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't save this category. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add category" })).toBeEnabled();
  });
});

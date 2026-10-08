import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ removeCategory: vi.fn(), saveCategory: vi.fn() }));
vi.mock("@/app/(app)/products/categories/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { CategoryForm } from "./category-form";

describe("CategoryForm", () => {
  it("saves a new category with its default footprints", async () => {
    const user = userEvent.setup();
    actions.saveCategory.mockResolvedValue({ status: "saved" });
    const onDone = vi.fn();
    render(<CategoryForm onDone={onDone} />);
    await user.type(screen.getByLabelText("Name"), "Denim");
    await user.click(screen.getByRole("button", { name: "Add category" }));
    expect(actions.saveCategory).toHaveBeenCalledWith(null, null, { name: "Denim", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 8 });
    expect(onDone).toHaveBeenCalled();
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

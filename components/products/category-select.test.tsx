import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ addCategory: vi.fn() }));
vi.mock("@/app/(app)/products/actions", () => actions);

import type { CategoryRow } from "@/lib/products/queries";

import { CategorySelect } from "./category-select";

const pants: CategoryRow = { id: "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10", name: "Pants", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 8, version: 1, productCount: 0 };

beforeEach(() => vi.clearAllMocks());

describe("CategorySelect", () => {
  it("says so and frees the button when adding a category throws", async () => {
    const user = userEvent.setup();
    actions.addCategory.mockRejectedValue(new Error("offline"));
    render(<CategorySelect categories={[pants]} value={pants.id} onChange={vi.fn()} onAdded={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Category"), "New category…");
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Category name"), "Tops");
    await user.click(within(dialog).getByRole("button", { name: "Add category" }));
    expect(within(dialog).getByLabelText("Category name")).toHaveAccessibleDescription("Couldn't add the category. Check your connection and try again.");
    expect(within(dialog).getByRole("button", { name: "Add category" })).toBeEnabled();
  });
});

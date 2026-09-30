import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProductList, type ProductSummary } from "./product-list";

const PRODUCTS: ProductSummary[] = [
  {
    id: "1",
    name: "High-rise pant",
    styleNumber: "HR-2041",
    category: "Pants",
    color: "Black",
    status: "in_stock",
  },
  {
    id: "2",
    name: "Straight jean",
    styleNumber: "SJ-1180",
    category: "Denim",
    color: "Indigo",
    status: "sold_out",
  },
];

describe("ProductList", () => {
  it("shows each product with its status in words", () => {
    render(<ProductList products={PRODUCTS} />);
    expect(screen.getByRole("button", { name: /High-rise pant/ })).toHaveTextContent(
      "In stock",
    );
    expect(screen.getByRole("button", { name: /Straight jean/ })).toHaveTextContent(
      "Sold out",
    );
  });

  it("opens a product's details in a sheet", async () => {
    const user = userEvent.setup();
    render(<ProductList products={PRODUCTS} />);

    await user.click(screen.getByRole("button", { name: /Straight jean/ }));

    const sheet = screen.getByRole("dialog", { name: "Straight jean" });
    expect(within(sheet).getByText("SJ-1180")).toBeVisible();
    expect(within(sheet).getByText("Denim")).toBeVisible();
    expect(within(sheet).getByText("Indigo")).toBeVisible();
    expect(within(sheet).getByText("Sold out")).toBeVisible();
  });

  it("returns focus to the product after closing", async () => {
    const user = userEvent.setup();
    render(<ProductList products={PRODUCTS} />);
    const row = screen.getByRole("button", { name: /Straight jean/ });

    await user.click(row);
    // Focus has to leave the row first, or "returned" proves nothing.
    const sheet = screen.getByRole("dialog", { name: "Straight jean" });
    await waitFor(() => expect(sheet).toContainElement(document.activeElement as HTMLElement));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(row).toHaveFocus();
  });
});

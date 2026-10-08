import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductRow } from "@/lib/products/queries";

import { ProductRows } from "./product-rows";

const row: ProductRow = {
  id: "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10",
  name: "High-Rise Pant",
  styleNumber: "HRP-01",
  color: "Black",
  sizeRange: "24–34",
  status: "sold_out",
  version: 3,
  categoryId: "c",
  categoryName: "Pants",
  imageKey: null,
};

describe("ProductRows", () => {
  it("links each product to its edit page with its details and status word", () => {
    render(<ProductRows products={[row]} />);
    const link = screen.getByRole("link", { name: /High-Rise Pant/ });
    expect(link).toHaveAttribute("href", `/products/${row.id}`);
    expect(within(link).getByText("HRP-01 · Pants · Black")).toBeInTheDocument();
    expect(within(link).getByText("Sold out")).toBeInTheDocument();
  });
});

// The product form's Status field offers what the person's switches allow (spec 0.7 §4.2):
// the server refuses the rest. Split from product-form.test.tsx.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/products/actions", () => ({ saveProduct: vi.fn(), addCategory: vi.fn(), removeProduct: vi.fn() }));
vi.mock("@/app/(app)/products/image-actions", () => ({ uploadProductImage: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("./resize-image", () => ({ resizeImage: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { EVERYTHING } from "@/lib/access/test-guard";
import type { CategoryRow } from "@/lib/products/queries";

import { ProductForm } from "./product-form";

const pants: CategoryRow = { id: "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10", name: "Pants", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, sizeRange: "", version: 1, productCount: 0 };
const statusOptions = () => within(screen.getByLabelText("Status")).getAllByRole("option").map((o) => o.textContent);

describe("ProductForm status choices follow the person's switches", () => {
  it("offers every status to someone who may stock and sell", () => {
    render(<ProductForm member={EVERYTHING} categories={[pants]} />);
    expect(statusOptions()).toEqual(["In stock", "Sold out", "On sale"]);
  });

  it("offers a new product In stock and Sold out only, without products.sale", () => {
    render(<ProductForm member={{ switches: ["view", "products.edit", "products.stock"] }} categories={[pants]} />);
    expect(statusOptions()).toEqual(["In stock", "Sold out"]);
  });

  it("offers only In stock without either status switch", () => {
    render(<ProductForm member={{ switches: ["view", "products.edit"] }} categories={[pants]} />);
    expect(statusOptions()).toEqual(["In stock"]);
  });
});

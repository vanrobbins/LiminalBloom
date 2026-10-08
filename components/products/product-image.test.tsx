import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductImage } from "./product-image";

const id = "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10";

describe("ProductImage", () => {
  it("loads the image through the store-checked route, cache-busted by its key", () => {
    render(<ProductImage productId={id} name="High-Rise Pant" categoryName="Pants" imageKey="abc.webp" />);
    expect(screen.getByRole("img", { name: "High-Rise Pant" })).toHaveAttribute("src", `/api/images/${id}?v=abc.webp`);
  });

  it("draws the category's silhouette when there is no image, or it fails to load", () => {
    const { rerender } = render(<ProductImage productId={id} name="High-Rise Pant" categoryName="Pants" imageKey={null} />);
    expect(screen.getByRole("img", { name: "High-Rise Pant (no photo)" })).toBeInTheDocument();
    rerender(<ProductImage productId={id} name="Tee" categoryName="Tees" imageKey="x.webp" />);
    fireEvent.error(screen.getByRole("img", { name: "Tee" }));
    expect(screen.getByRole("img", { name: "Tee (no photo)" })).toBeInTheDocument();
  });
});

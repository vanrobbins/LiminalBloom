import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductImage } from "./product-image";

const id = "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10";

describe("ProductImage", () => {
  it("loads the image through the store-checked route, cache-busted by its key", () => {
    render(<ProductImage productId={id} name="High-Rise Pant" categoryName="Pants" imageKey="abc.webp" />);
    expect(screen.getByRole("img", { name: "High-Rise Pant" })).toHaveAttribute("src", `/api/images/${id}?v=abc.webp`);
  });

  it("can't be dragged by the browser, which would steal a planogram tile's mouse drag", () => {
    render(<ProductImage productId={id} name="High-Rise Pant" categoryName="Pants" imageKey="abc.webp" />);
    expect(screen.getByRole("img", { name: "High-Rise Pant" })).toHaveAttribute("draggable", "false");
  });

  it("decorative: the photo has an empty alt and the silhouette is hidden from screen readers", () => {
    const { container, rerender } = render(<ProductImage productId={id} name="Pant" categoryName="Pants" imageKey="a.webp" size="fill" decorative />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    rerender(<ProductImage productId={id} name="Pant" categoryName="Pants" imageKey={null} size="fill" decorative />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg).not.toHaveAttribute("aria-label");
  });

  it("draws the category's silhouette when there is no image, or it fails to load", () => {
    const { rerender } = render(<ProductImage productId={id} name="High-Rise Pant" categoryName="Pants" imageKey={null} />);
    expect(screen.getByRole("img", { name: "High-Rise Pant (no photo)" })).toBeInTheDocument();
    rerender(<ProductImage productId={id} name="Tee" categoryName="Tees" imageKey="x.webp" />);
    fireEvent.error(screen.getByRole("img", { name: "Tee" }));
    expect(screen.getByRole("img", { name: "Tee (no photo)" })).toBeInTheDocument();
  });

  it("draws an old seed- image instead of loading it, so tiles get the right view", () => {
    const { container } = render(<ProductImage productId={id} name="Pant" categoryName="Pants" imageKey="seed-0123456789abcdef.svg" view="folded-top" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("data-view", "folded-top");
  });

  it("draws laid flat by default, in the product's shape, colour word and texture", () => {
    const { container } = render(<ProductImage productId={id} name="Chino Short" categoryName="Pants" imageKey={null} colorWord="Navy" texture="stripes" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-view", "flat");
    expect(svg).toHaveAttribute("data-drawing", "shorts");
    expect(svg).toHaveAttribute("data-texture", "stripes");
    expect(svg.getAttribute("data-fill")).toMatch(/^oklch\(32\.0% /);
    expect(svg.querySelector("pattern")).not.toBeNull();
  });

  it("prefers the swatch to the colour word, and stays neutral with neither", () => {
    const { container, rerender } = render(<ProductImage productId={id} name="Tee" categoryName="Tees" imageKey={null} swatch="#7a2e3b" colorWord="Navy" />);
    expect(container.querySelector("svg")!.getAttribute("data-fill")).not.toMatch(/^oklch\(32\.0% /);
    rerender(<ProductImage productId={id} name="Tee" categoryName="Tees" imageKey={null} colorWord="Sunset" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-fill", "var(--line)");
  });

  it("gives every drawing on a page its own pattern id", () => {
    const { container } = render(
      <>
        <ProductImage productId={id} name="A" categoryName="Tees" imageKey={null} texture="dots" />
        <ProductImage productId={id} name="B" categoryName="Tees" imageKey={null} texture="dots" />
      </>,
    );
    const ids = [...container.querySelectorAll("pattern")].map((p) => p.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

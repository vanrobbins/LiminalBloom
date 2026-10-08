import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ saveProduct: vi.fn(), addCategory: vi.fn(), removeProduct: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const images = vi.hoisted(() => ({ uploadProductImage: vi.fn() }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
// What Safari hands back: it can't encode WebP, so the photo comes out JPEG.
const resized = vi.hoisted(() => new Blob(["small"], { type: "image/jpeg" }));
vi.mock("@/app/(app)/products/actions", () => actions);
vi.mock("@/app/(app)/products/image-actions", () => images);
vi.mock("@/lib/toast", () => toasts);
vi.mock("./resize-image", () => ({ resizeImage: vi.fn(async () => resized) }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { CategoryRow } from "@/lib/products/queries";

import { ProductForm } from "./product-form";

const pants: CategoryRow = { id: "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10", name: "Pants", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 8, version: 1, productCount: 0 };

beforeEach(() => vi.clearAllMocks());

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "High-Rise Pant");
  await user.type(screen.getByLabelText("Style number"), "HRP-01");
  await user.type(screen.getByLabelText("Color"), "Black");
}

describe("ProductForm", () => {
  it("sends the product with its overrides and goes back to the library", async () => {
    const user = userEvent.setup();
    actions.saveProduct.mockResolvedValue({ status: "saved", id: "new-id" });
    render(<ProductForm categories={[pants]} />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Override folded for this product" }));
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(actions.saveProduct).toHaveBeenCalledWith(null, null, expect.objectContaining({
      name: "High-Rise Pant",
      categoryId: pants.id,
      status: "in_stock",
      overrides: { hung: null, folded: { columns: 2, rows: 2, stackLimit: 8 } },
    }));
    expect(router.push).toHaveBeenCalledWith("/products");
  });

  it("shows the server's field errors beside the fields", async () => {
    const user = userEvent.setup();
    actions.saveProduct.mockResolvedValue({ status: "invalid", errors: { styleNumber: "Another product already uses this style number." } });
    render(<ProductForm categories={[pants]} />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(screen.getByLabelText("Style number")).toHaveAccessibleDescription("Another product already uses this style number.");
  });

  it("says when another device saved first, and reloads", async () => {
    const user = userEvent.setup();
    actions.saveProduct.mockResolvedValue({ status: "conflict" });
    render(
      <ProductForm
        categories={[pants]}
        product={{ id: "p", name: "A", styleNumber: "A-1", color: "Red", sizeRange: "", status: "in_stock", version: 2, categoryId: pants.id, categoryName: "Pants", imageKey: null }}
        overrides={{}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(actions.saveProduct).toHaveBeenCalledWith("p", 2, expect.anything());
    expect(router.refresh).toHaveBeenCalled();
  });

  it("names the uploaded file after the image's real type", async () => {
    const user = userEvent.setup();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    actions.saveProduct.mockResolvedValue({ status: "saved", id: "new-id" });
    images.uploadProductImage.mockResolvedValue({ status: "saved", imageKey: "k" });
    render(<ProductForm categories={[pants]} />);
    await fillRequired(user);
    await user.upload(screen.getByLabelText("Choose image"), new File(["big"], "photo.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Add product" }));
    const sent = images.uploadProductImage.mock.calls[0][1].get("image") as File;
    expect(sent.name).toBe("image.jpg");
    expect(sent.type).toBe("image/jpeg");
  });

  it("keeps a saved product saved when the image upload fails on the way", async () => {
    const user = userEvent.setup();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    actions.saveProduct.mockResolvedValue({ status: "saved", id: "new-id" });
    images.uploadProductImage.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ProductForm categories={[pants]} />);
    await fillRequired(user);
    await user.upload(screen.getByLabelText("Choose image"), new File(["big"], "photo.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Saved, but the image wasn't" }));
    expect(toasts.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't save" }));
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "success", title: "Product added" }));
    expect(router.push).toHaveBeenCalledWith("/products");
  });
});

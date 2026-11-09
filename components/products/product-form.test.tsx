import { render, screen, within } from "@testing-library/react";
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

const pants: CategoryRow = { id: "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10", name: "Pants", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, sizeRange: "", version: 1, productCount: 0 };

beforeEach(() => vi.clearAllMocks());

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "High-Rise Pant");
  await user.type(screen.getByLabelText("Style number"), "HRP-01");
  await user.type(screen.getByLabelText("Color"), "Black");
}

describe("ProductForm", () => {
  it("sends the product with its own space and goes back to Products", async () => {
    const user = userEvent.setup();
    actions.saveProduct.mockResolvedValue({ status: "saved", id: "new-id" });
    render(<ProductForm categories={[pants]} />);
    await fillRequired(user);
    const space = screen.getByRole("group", { name: "Space on the fixture" });
    await user.click(within(space).getByRole("radio", { name: "Different for this product" }));
    await user.click(screen.getByRole("button", { name: "More folded width" }));
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(actions.saveProduct).toHaveBeenCalledWith(null, null, expect.objectContaining({
      name: "High-Rise Pant",
      categoryId: pants.id,
      status: "in_stock",
      sizeRange: null,
      overrides: { hung: { columns: 1, rows: 3 }, folded: { columns: 3, rows: 2 } },
    }));
    expect(router.push).toHaveBeenCalledWith("/products");
  });

  it("uses the category's space by default, in words, and says when different numbers match it", async () => {
    const user = userEvent.setup();
    render(<ProductForm categories={[pants]} />);
    const space = screen.getByRole("group", { name: "Space on the fixture" });
    expect(within(space).getByRole("radio", { name: "Same as Pants" })).toBeChecked();
    expect(within(space).getByText("Hung: ½ ft wide, 3 rows high")).toBeInTheDocument();
    expect(within(space).queryByRole("group", { name: "Hung width" })).toBeNull();
    await user.click(within(space).getByRole("radio", { name: "Different for this product" }));
    expect(within(space).getByText("Same as the category, so nothing to save.")).toBeInTheDocument();
  });

  it("drops the product's own space when it goes back to the category's, keeping the typed numbers until then", async () => {
    const user = userEvent.setup();
    actions.saveProduct.mockResolvedValue({ status: "saved", id: "p" });
    render(
      <ProductForm
        categories={[pants]}
        product={{ id: "p", name: "A", styleNumber: "A-1", color: "Red", sizeRange: "", status: "in_stock", version: 2, categoryId: pants.id, categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid" }}
        overrides={{ hung: { columns: 4, rows: 3 } }}
      />,
    );
    const space = screen.getByRole("group", { name: "Space on the fixture" });
    expect(within(space).getByRole("radio", { name: "Different for this product" })).toBeChecked();
    await user.click(within(space).getByRole("radio", { name: "Same as Pants" }));
    await user.click(within(space).getByRole("radio", { name: "Different for this product" }));
    expect(within(space).getByText("Hung: 2 ft wide, 3 rows high")).toBeInTheDocument();
    await user.click(within(space).getByRole("radio", { name: "Same as Pants" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(actions.saveProduct).toHaveBeenCalledWith("p", 2, expect.objectContaining({ overrides: { hung: null, folded: null } }));
  });

  it("inherits the category's size range, or saves its own from a quick pick", async () => {
    const user = userEvent.setup();
    actions.saveProduct.mockResolvedValue({ status: "saved", id: "new-id" });
    render(<ProductForm categories={[{ ...pants, sizeRange: "24–34" }]} />);
    await fillRequired(user);
    const size = screen.getByRole("group", { name: "Size range" });
    expect(within(size).getByText("24–34")).toBeInTheDocument();
    await user.click(within(size).getByRole("radio", { name: "Different for this product" }));
    await user.click(within(size).getByRole("button", { name: "0–14" }));
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(actions.saveProduct).toHaveBeenCalledWith(null, null, expect.objectContaining({ sizeRange: "0–14" }));
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
        product={{ id: "p", name: "A", styleNumber: "A-1", color: "Red", sizeRange: "", status: "in_stock", version: 2, categoryId: pants.id, categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid" }}
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

  it("saves a picked swatch and texture with the form, and the preview follows them", async () => {
    const user = userEvent.setup();
    actions.saveProduct.mockResolvedValue({ status: "saved", id: "new-id" });
    render(<ProductForm categories={[pants]} />);
    await fillRequired(user);
    const preview = screen.getByRole("img", { name: "Preview" });
    expect(preview).toHaveAttribute("data-drawing", "pants");
    await user.click(screen.getByRole("radio", { name: "Pick a color" }));
    const hex = screen.getByLabelText("Hex");
    await user.clear(hex);
    await user.type(hex, "#7a2e3b");
    await user.click(within(screen.getByRole("group", { name: "Texture" })).getByRole("button", { name: "Denim" }));
    expect(preview).toHaveAttribute("data-texture", "denim");
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(actions.saveProduct).toHaveBeenCalledWith(null, null, expect.objectContaining({ swatch: "#7a2e3b", texture: "denim" }));
  });

  it("matches the colour word by default, and saves no swatch", async () => {
    const user = userEvent.setup();
    actions.saveProduct.mockResolvedValue({ status: "saved", id: "new-id" });
    render(<ProductForm categories={[pants]} />);
    await fillRequired(user);
    expect(screen.getByRole("radio", { name: "Match the color word" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(actions.saveProduct).toHaveBeenCalledWith(null, null, expect.objectContaining({ swatch: null, texture: "solid" }));
  });

  it("asks for a category when there are several, instead of quietly picking the first", async () => {
    const user = userEvent.setup();
    const tees: CategoryRow = { ...pants, id: "0b7f8e2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b", name: "Tees" };
    render(<ProductForm categories={[pants, tees]} />);
    const select = screen.getByLabelText("Category");
    expect(select).toHaveValue("");
    expect(within(select).getByRole("option", { name: "Choose a category" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Space on the fixture" })).not.toBeInTheDocument();
    await user.selectOptions(select, "Tees");
    expect(screen.getByRole("group", { name: "Space on the fixture" })).toBeInTheDocument();
  });
});

// Who may use the product, category and image actions (spec 0.7 §4.7): each is refused
// without products.edit and writes nothing, and goes through with it. The writes are
// stood in for, so "writes nothing" is a mock that was never called.

import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const writes = vi.hoisted(() => ({
  createProduct: vi.fn(async () => ({ status: "saved", id: "new-id" })),
  updateProduct: vi.fn(async () => ({ status: "saved" })),
  deleteProduct: vi.fn(async () => ({ status: "saved", imagePath: null })),
  productStatus: vi.fn(async () => "in_stock"),
  setProductImage: vi.fn(async () => ({ status: "saved", previous: null })),
  createCategory: vi.fn(async () => ({ status: "saved", id: "cat-1" })),
  updateCategory: vi.fn(async () => ({ status: "saved" })),
  deleteCategory: vi.fn(async () => ({ status: "saved", imagePaths: [] })),
  putImage: vi.fn(async () => {}),
  listCategories: vi.fn(async () => [{ id: "cat-1", name: "Pants" }]),
}));
vi.mock("@/lib/current-member");
vi.mock("@/lib/products/write", () => ({
  createProduct: writes.createProduct,
  updateProduct: writes.updateProduct,
  deleteProduct: writes.deleteProduct,
  productStatus: writes.productStatus,
  setProductImage: writes.setProductImage,
}));
vi.mock("@/lib/products/category-write", () => ({ createCategory: writes.createCategory, updateCategory: writes.updateCategory, deleteCategory: writes.deleteCategory }));
vi.mock("@/lib/products/images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/products/images")>()),
  putImage: writes.putImage,
  deleteImagesQuietly: vi.fn(async () => {}),
}));
vi.mock("@/lib/products/queries", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/products/queries")>()), listCategories: writes.listCategories }));

import type { Switch } from "@/lib/access/switches";
import { guardFor, memberWith } from "@/lib/access/test-guard";
import * as currentMember from "@/lib/current-member";

import { addCategory, removeProduct, saveProduct } from "./actions";
import { removeCategory, saveCategory } from "./categories/actions";
import { uploadProductImage } from "./image-actions";

let who = memberWith("store_a", ["view"]);
const as = (...switches: Switch[]) => {
  who = memberWith("store_a", ["view", ...switches]);
};
beforeEach(() => {
  vi.clearAllMocks();
  writes.productStatus.mockResolvedValue("in_stock");
  as();
  vi.mocked(currentMember.requireSwitchForAction).mockImplementation(guardFor(() => who));
});

const noWrites = () => {
  for (const [name, fn] of Object.entries(writes)) if (name !== "productStatus" && name !== "listCategories") expect(fn, name).not.toHaveBeenCalled();
};

const id = randomUUID();
const category = randomUUID();
const input = (status = "in_stock") => ({ name: "Tee", styleNumber: "T-1", categoryId: category, color: "Black", sizeRange: null, status, overrides: { hung: null, folded: null } });
const categoryInput = { name: "Tees", hungColumns: 2, hungRows: 3, foldedColumns: 4, foldedRows: 2 };
const image = () => {
  const form = new FormData();
  // A JPEG's first bytes: enough for the type check.
  form.set("image", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])], "a.jpg", { type: "image/jpeg" }));
  return form;
};

describe("products/actions need products.edit", () => {
  it("saveProduct (create and edit)", async () => {
    expect(await saveProduct(null, null, input())).toEqual({ status: "forbidden" });
    expect(await saveProduct(id, 1, input())).toEqual({ status: "forbidden" });
    noWrites();
    as("products.edit");
    expect(await saveProduct(null, null, input())).toEqual({ status: "saved", id: "new-id" });
    expect(await saveProduct(id, 1, input())).toMatchObject({ status: "saved" });
  });

  it("removeProduct", async () => {
    expect(await removeProduct(id, 1)).toEqual({ status: "forbidden" });
    noWrites();
    as("products.edit");
    expect(await removeProduct(id, 1)).toEqual({ status: "saved" });
  });

  it("addCategory", async () => {
    expect(await addCategory("Tees")).toEqual({ status: "forbidden" });
    noWrites();
    as("products.edit");
    expect(await addCategory("Tees")).toMatchObject({ status: "saved" });
  });

  // The form carries a status, so products.edit alone must not be a way round stock and sale.
  it("saveProduct checks a status change against the same switches as the status control", async () => {
    as("products.edit");
    expect(await saveProduct(id, 1, input("on_sale"))).toEqual({ status: "forbidden" });
    expect(await saveProduct(id, 1, input("sold_out"))).toEqual({ status: "forbidden" });
    expect(await saveProduct(null, null, input("on_sale"))).toEqual({ status: "forbidden" });
    noWrites();
    as("products.edit", "products.sale");
    expect(await saveProduct(id, 1, input("on_sale"))).toMatchObject({ status: "saved" });
    as("products.edit", "products.stock");
    expect(await saveProduct(id, 1, input("sold_out"))).toMatchObject({ status: "saved" });
    // No change of status: nothing more is needed.
    as("products.edit");
    expect(await saveProduct(id, 1, input("in_stock"))).toMatchObject({ status: "saved" });
  });
});

describe("categories/actions need products.edit", () => {
  it("saveCategory (create and edit)", async () => {
    expect(await saveCategory(null, null, categoryInput)).toEqual({ status: "forbidden" });
    expect(await saveCategory(id, 1, categoryInput)).toEqual({ status: "forbidden" });
    noWrites();
    as("products.edit");
    expect(await saveCategory(null, null, categoryInput)).toEqual({ status: "saved" });
    expect(await saveCategory(id, 1, categoryInput)).toEqual({ status: "saved" });
  });

  it("removeCategory", async () => {
    expect(await removeCategory(id, 1, 0)).toEqual({ status: "forbidden" });
    noWrites();
    as("products.edit");
    expect(await removeCategory(id, 1, 0)).toEqual({ status: "saved" });
  });
});

describe("image-actions need products.edit", () => {
  it("uploadProductImage", async () => {
    expect(await uploadProductImage(id, image())).toEqual({ status: "forbidden" });
    noWrites();
    as("products.edit");
    expect(await uploadProductImage(id, image())).toMatchObject({ status: "saved" });
    expect(writes.putImage).toHaveBeenCalledTimes(1);
  });
});

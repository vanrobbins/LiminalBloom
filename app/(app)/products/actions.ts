"use server";

// Saving the library's forms (spec §5.2). Input is parsed here, never trusted
// from the browser, and the store comes from the session (CODESTYLE rule 8).

import { z } from "zod";

import { requireMember } from "@/lib/current-member";
import { deleteImagesQuietly, withoutSeedImages } from "@/lib/products/images";
import { listCategories, type CategoryRow } from "@/lib/products/queries";
import { categoryInput, fieldErrors, productInput } from "@/lib/products/schemas";
import { createCategory, createProduct, deleteProduct, updateProduct } from "@/lib/products/write";

export type FormResult =
  | { status: "saved"; id: string }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "conflict" };

const uuid = z.uuid();
const isVersion = (v: number) => Number.isInteger(v) && v >= 1;

export async function saveProduct(productId: string | null, expectedVersion: number | null, raw: unknown): Promise<FormResult> {
  const { activeStoreId } = await requireMember();
  const parsed = productInput.safeParse(raw);
  if (!parsed.success) return { status: "invalid", errors: fieldErrors(parsed.error) };

  // An edit needs both its id and the version it was loaded at; one without the other is not a create.
  if ((productId === null) !== (expectedVersion === null)) {
    return { status: "invalid", errors: { name: "Couldn't save this product. Reload and try again." } };
  }
  const isEdit = productId !== null && expectedVersion !== null;
  if (isEdit && (!uuid.safeParse(productId).success || !isVersion(expectedVersion))) return { status: "conflict" };
  const result = isEdit
    ? await updateProduct(activeStoreId, productId, expectedVersion, parsed.data)
    : await createProduct(activeStoreId, parsed.data);

  switch (result.status) {
    case "saved":
      return { status: "saved", id: "id" in result && typeof result.id === "string" ? result.id : (productId as string) };
    case "duplicate":
      return { status: "invalid", errors: { styleNumber: "Another product already uses this style number." } };
    case "not-found":
      return { status: "invalid", errors: { categoryId: "That category no longer exists. Choose another." } };
    case "conflict":
      return { status: "conflict" };
  }
}

export async function removeProduct(productId: string, expectedVersion: number): Promise<{ status: "saved" } | { status: "conflict" }> {
  const { activeStoreId } = await requireMember();
  if (!uuid.safeParse(productId).success || !isVersion(expectedVersion)) return { status: "conflict" };
  const result = await deleteProduct(activeStoreId, productId, expectedVersion);
  if (result.status !== "saved") return { status: "conflict" };
  // Seed images are shared between products; only a user's own upload goes.
  if (result.imagePath) await deleteImagesQuietly(withoutSeedImages([result.imagePath]));
  return { status: "saved" };
}

/** "New category…" from the product form: a name, with the usual defaults. */
export async function addCategory(name: string): Promise<{ status: "saved"; category: CategoryRow } | { status: "invalid"; message: string }> {
  const { activeStoreId } = await requireMember();
  const parsed = categoryInput.safeParse({ name, hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 8 });
  if (!parsed.success) return { status: "invalid", message: fieldErrors(parsed.error).name ?? "Enter a name." };
  const result = await createCategory(activeStoreId, parsed.data);
  if (result.status === "duplicate") return { status: "invalid", message: "There is already a category with that name." };
  if (result.status !== "saved") return { status: "invalid", message: "Couldn't add the category. Try again." };
  const category = (await listCategories(activeStoreId)).find((c) => c.id === result.id);
  if (!category) return { status: "invalid", message: "Couldn't add the category. Try again." };
  return { status: "saved", category };
}

"use server";

// Saving and deleting categories (spec §5.1, §5.3). Deleting sends back the
// count the dialog showed, so no more products go than the person agreed to.

import { z } from "zod";

import { requireMember } from "@/lib/current-member";
import { deleteImagesQuietly, withoutSeedImages } from "@/lib/products/images";
import { categoryInput, fieldErrors } from "@/lib/products/schemas";
import { createCategory, deleteCategory, updateCategory } from "@/lib/products/write";

export type CategoryFormResult =
  | { status: "saved" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "conflict" };

const uuid = z.uuid();
const isVersion = (v: number) => Number.isInteger(v) && v >= 1;

export async function saveCategory(id: string | null, expectedVersion: number | null, raw: unknown): Promise<CategoryFormResult> {
  const { activeStoreId } = await requireMember();
  const parsed = categoryInput.safeParse(raw);
  if (!parsed.success) return { status: "invalid", errors: fieldErrors(parsed.error) };
  // An edit needs both its id and the version it was loaded at; one without the other is not a create.
  if ((id === null) !== (expectedVersion === null)) return { status: "conflict" };
  const isEdit = id !== null && expectedVersion !== null;
  if (isEdit && (!uuid.safeParse(id).success || !isVersion(expectedVersion))) return { status: "conflict" };
  const result = isEdit
    ? await updateCategory(activeStoreId, id, expectedVersion, parsed.data)
    : await createCategory(activeStoreId, parsed.data);
  if (result.status === "saved") return { status: "saved" };
  if (result.status === "duplicate") return { status: "invalid", errors: { name: "There is already a category with that name." } };
  return { status: "conflict" };
}

export async function removeCategory(
  id: string,
  expectedVersion: number,
  expectedCount: number,
): Promise<{ status: "saved" } | { status: "conflict" } | { status: "count-changed"; count: number }> {
  const { activeStoreId } = await requireMember();
  if (!uuid.safeParse(id).success || !isVersion(expectedVersion) || !Number.isInteger(expectedCount) || expectedCount < 0) {
    return { status: "conflict" };
  }
  const result = await deleteCategory(activeStoreId, id, expectedVersion, expectedCount);
  if (result.status !== "saved") return result;
  // Seed images are shared between products; only a user's own uploads go.
  await deleteImagesQuietly(withoutSeedImages(result.imagePaths));
  return { status: "saved" };
}

"use server";

// Changing a product's status from the location sheet (§3.2 item 8): saved at
// once, version-guarded, and everyone sees it on their next search.

import { z } from "zod";

import { requireMember } from "@/lib/current-member";
import type { ProductStatus } from "@/lib/product-status";
import { productDetail, type ProductRow } from "@/lib/products/queries";
import { statusInput } from "@/lib/products/schemas";
import { setProductStatus } from "@/lib/products/write";

const isVersion = (v: number) => Number.isInteger(v) && v >= 1;

export async function changeStatus(
  productId: string,
  expectedVersion: number,
  status: ProductStatus,
): Promise<{ status: "saved"; version: number } | { status: "conflict"; product: ProductRow | null }> {
  const { activeStoreId } = await requireMember();
  if (!z.uuid().safeParse(productId).success || !statusInput.safeParse(status).success || !isVersion(expectedVersion)) {
    return { status: "conflict", product: null };
  }
  const result = await setProductStatus(activeStoreId, productId, expectedVersion, status);
  if (result.status === "saved") return { status: "saved", version: result.version };
  return { status: "conflict", product: (await productDetail(activeStoreId, productId))?.product ?? null };
}

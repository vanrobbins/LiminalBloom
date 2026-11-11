"use server";

// Changing a product's status from the location sheet (§3.2 item 8): saved at
// once, version-guarded, and everyone sees it on their next search.

import { z } from "zod";

import { statusChangeNeeds } from "@/lib/access/rank";
import { requireSwitchForAction } from "@/lib/current-member";
import type { ProductStatus } from "@/lib/product-status";
import { productDetail, type ProductRow } from "@/lib/products/queries";
import { statusInput } from "@/lib/products/schemas";
import { productStatus, setProductStatus } from "@/lib/products/write";

const isVersion = (v: number) => Number.isInteger(v) && v >= 1;

export type StatusReply = { status: "saved"; version: number } | { status: "conflict"; product: ProductRow | null } | { status: "forbidden" };

export async function changeStatus(productId: string, expectedVersion: number, status: ProductStatus): Promise<StatusReply> {
  // Which switch the change needs depends on the status it starts from, and the browser's
  // idea of that is only a hint: read it here, check against what the database holds.
  const view = await requireSwitchForAction("view");
  if (view.status === "forbidden") return { status: "forbidden" };
  const { activeStoreId } = view.member;
  if (!z.uuid().safeParse(productId).success || !statusInput.safeParse(status).success || !isVersion(expectedVersion)) {
    return { status: "conflict", product: null };
  }
  const current = await productStatus(activeStoreId, productId);
  const stale = async (): Promise<StatusReply> => ({ status: "conflict", product: (await productDetail(activeStoreId, productId))?.product ?? null });
  if (current === null) return stale();
  const needs = statusChangeNeeds(current, status);
  // Already there (another device got to it first): show what is true, change nothing.
  if (needs === "unchanged") return stale();
  const allowed = await requireSwitchForAction(needs);
  if (allowed.status === "forbidden") return { status: "forbidden" };

  // The write matches only while the product still has the status just checked.
  const result = await setProductStatus(activeStoreId, productId, expectedVersion, current, status);
  if (result.status === "saved") return { status: "saved", version: result.version };
  return stale();
}

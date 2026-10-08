import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { DeleteProductButton } from "@/components/products/delete-product-button";
import { ProductForm } from "@/components/products/product-form";
import { requireMember } from "@/lib/current-member";
import { listCategories, productDetail } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { activeStoreId } = await requireMember();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, categories] = await Promise.all([productDetail(activeStoreId, id), listCategories(activeStoreId)]);
  if (!detail) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/products" className="inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:underline">
        ← Product library
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-ink wrap-anywhere">{detail.product.name}</h1>
      {/* Keyed by version: after "changed on another device" the refreshed values replace the typed ones. */}
      <ProductForm key={detail.product.version} categories={categories} product={detail.product} overrides={detail.overrides} />
      <div className="mt-10 border-t border-line-subtle pt-6">
        <DeleteProductButton productId={detail.product.id} version={detail.product.version} name={detail.product.name} />
      </div>
    </div>
  );
}

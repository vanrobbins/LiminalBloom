import Link from "next/link";

import { ProductForm } from "@/components/products/product-form";
import { requireMember } from "@/lib/current-member";
import { listCategories } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const { activeStoreId } = await requireMember();
  const categories = await listCategories(activeStoreId);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/products" className="inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:underline">
        ← Product library
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-ink">Add product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}

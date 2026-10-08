import Link from "next/link";

import { CategoryList } from "@/components/products/category-list";
import { requireMember } from "@/lib/current-member";
import { listCategories } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { activeStoreId } = await requireMember();
  const categories = await listCategories(activeStoreId);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/products" className="inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:underline">
        ← Product library
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Categories</h1>
      <p className="mt-2 mb-6 text-ink-muted">Each category sets the cells its products cover; a product only needs its own when it differs.</p>
      <CategoryList categories={categories} />
    </div>
  );
}

import { CategoryList } from "@/components/products/category-list";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/current-member";
import { listCategories } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { activeStoreId } = await requireMember();
  const categories = await listCategories(activeStoreId);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Categories" back={{ href: "/products", label: "Products" }} />
      <p className="mb-6 text-ink-muted">Each category sets how much room its products take on a fixture; a product only needs its own when it differs.</p>
      <CategoryList categories={categories} />
    </div>
  );
}

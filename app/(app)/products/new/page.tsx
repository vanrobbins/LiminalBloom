import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/shell/page-header";
import { requireSwitch } from "@/lib/current-member";
import { listCategories } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const member = await requireSwitch("products.edit");
  const { activeStoreId } = member;
  const categories = await listCategories(activeStoreId);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Add product" back={{ href: "/products", label: "Products" }} />
      <ProductForm categories={categories} member={member} />
    </div>
  );
}

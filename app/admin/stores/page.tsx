// /admin/stores (spec 0.7.1 7.3): every store, with its people, Store Managers and whether it is paused.

import { StoreList } from "@/components/admin/store-list";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { listStores } from "@/lib/admin/reads";

export const dynamic = "force-dynamic";

export default async function AdminStoresPage() {
  await requirePlatformAdmin();
  const stores = await listStores();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Stores</h1>
      <StoreList stores={stores} />
    </>
  );
}

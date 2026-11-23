// /admin/stores (spec 0.7.1 7.3): every store, with its people, Store Managers and whether it is paused.
// `?q=` narrows by name; the list stops at 500, and says so.

import { Search } from "lucide-react";

import { StoreList } from "@/components/admin/store-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { listStores, MAX_STORES } from "@/lib/admin/reads";
import { storeQuery } from "@/lib/admin/store-search";

export const dynamic = "force-dynamic";

export default async function AdminStoresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin();
  const q = storeQuery(await searchParams);
  const { stores, truncated } = await listStores(q);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Stores</h1>
      <form action="/admin/stores" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input label="Search by name" type="search" name="q" defaultValue={q} maxLength={100} autoComplete="off" enterKeyHint="search" className="sm:max-w-sm sm:flex-1" />
        <Button type="submit" className="self-start">
          <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
          Search
        </Button>
      </form>
      {truncated ? <p className="text-ink-muted">{`Showing the first ${MAX_STORES} stores. Search to find others.`}</p> : null}
      {stores.length === 0 && q ? <p className="text-ink-muted">No store has that name.</p> : <StoreList stores={stores} />}
    </>
  );
}

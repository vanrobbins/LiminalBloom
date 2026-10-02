// The store's map, read-only, for everyone in the store (spec §10). Editing
// happens on /layout/edit. The layout is loaded through withStore, so row-level
// security scopes it as well as the explicit store filter.

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapViewer } from "@/components/store-map/map-viewer";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";

// Always the current layout; another member may have just changed it.
export const dynamic = "force-dynamic";

export default async function LayoutPage() {
  const { stores, activeStoreId } = await requireMember();
  const store = stores.find((s) => s.id === activeStoreId);
  const layout = await loadLayout(activeStoreId);

  return (
    <>
      <p className="text-sm font-medium text-brand-strong">{store?.name ?? "Your store"}</p>
      <h1 className="mt-1 mb-4 text-3xl font-semibold tracking-tight text-ink">Store layout</h1>
      {layout.outline ? (
        <MapViewer layout={layout} />
      ) : (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-ink">This store has no layout yet.</p>
          <p className="text-sm text-ink-muted">Draw the sales floor once, and everything else (planograms, search) points at it.</p>
          <Button asChild>
            <a href="/layout/edit">Set up your store layout</a>
          </Button>
        </Card>
      )}
    </>
  );
}

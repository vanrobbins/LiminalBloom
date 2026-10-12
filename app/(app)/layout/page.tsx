// The store's map, read-only, for everyone in the store (spec §10). Editing
// happens on /layout/edit. The layout is loaded through withStore, so row-level
// security scopes it as well as the explicit store filter.

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapViewer } from "@/components/store-map/map-viewer";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { floorPlanograms } from "@/lib/planograms/floor-view";
import { productLooks } from "@/lib/planograms/product-looks";

// Always the current layout; another member may have just changed it.
export const dynamic = "force-dynamic";

export default async function LayoutPage() {
  const { activeStoreId } = await requireMember();
  const [layout, planograms] = await Promise.all([loadLayout(activeStoreId), floorPlanograms(activeStoreId)]);
  const looks = await productLooks(activeStoreId, Object.values(planograms).flatMap((p) => p.latest?.placements.map((e) => e.productId) ?? []));

  return (
    <>
      <PageHeader title="Store layout" />
      {layout.outline ? (
        <MapViewer layout={layout} planograms={planograms} looks={looks} />
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

// The store's map, read-only, for everyone in the store (spec §10). + Add and
// Edit switch to editing in the same area (A3); /layout/edit is the full-screen
// editor. The layout is loaded through withStore, so row-level
// security scopes it as well as the explicit store filter.

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutScreen } from "@/components/store-map/layout-screen";
import { PageHeader } from "@/components/shell/page-header";
import { can } from "@/lib/access/can";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { floorPlanograms } from "@/lib/planograms/floor-view";
import { productLooks } from "@/lib/planograms/product-looks";
import { nonceParam, uuidParam } from "@/lib/url-params";

import { fetchLayout, saveLayoutChanges } from "@/app/(editor)/layout/edit/actions";

// Always the current layout; another member may have just changed it.
export const dynamic = "force-dynamic";

// ?zone= is where the command palette's Zone result lands: the map opens on that zone.
export default async function LayoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const member = await requireMember();
  const params = await searchParams;
  const zone = uuidParam(params, "zone");
  const { activeStoreId } = member;
  const [layout, planograms] = await Promise.all([loadLayout(activeStoreId), floorPlanograms(activeStoreId)]);
  const looks = await productLooks(activeStoreId, Object.values(planograms).flatMap((p) => p.latest?.placements.map((e) => e.productId) ?? []));

  if (layout.outline) {
    return <LayoutScreen storeId={activeStoreId} layout={layout} planograms={planograms} looks={looks} save={saveLayoutChanges} fetchLatest={fetchLayout} member={member} initialZone={zone} nonce={nonceParam(params)} />;
  }

  return (
    <>
      <PageHeader title="Store layout" />
      <Card className="flex flex-col items-start gap-3">
        <p className="text-ink">This store has no layout yet.</p>
        {can(member, "layout.edit") ? (
          <>
            <p className="text-sm text-ink-muted">Draw the sales floor once, and everything else (planograms, search) points at it.</p>
            <Button asChild>
              <a href="/layout/edit">Set up your store layout</a>
            </Button>
          </>
        ) : null}
      </Card>
    </>
  );
}

// Planograms (spec §5.1): one per fixture, grouped by zone.

import { PlanogramList } from "@/components/planograms/planogram-list";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { todayIso } from "@/lib/planograms/dates";
import { planogramList } from "@/lib/planograms/list";
import { planogramSummaries } from "@/lib/planograms/queries";

export const dynamic = "force-dynamic";

export default async function PlanogramsPage() {
  const { activeStoreId } = await requireMember();
  const [layout, summaries] = await Promise.all([loadLayout(activeStoreId), planogramSummaries(activeStoreId)]);
  const groups = planogramList(layout, summaries);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Planograms" />
      {groups.length === 0 ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-ink">No fixtures that show product yet.</p>
          <p className="text-sm text-ink-muted">Add tables, racks or wall bays to the store layout, and each gets a planogram.</p>
          <Button asChild>
            <a href="/layout/edit">Edit the store layout</a>
          </Button>
        </Card>
      ) : (
        <PlanogramList groups={groups} today={todayIso()} />
      )}
    </div>
  );
}

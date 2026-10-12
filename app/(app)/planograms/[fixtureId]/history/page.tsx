// A planogram's published versions (spec §5.5).

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { HistoryList, type HistoryEntry } from "@/components/planograms/history-list";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { diffPlacements, goneFaces, sortByFaceOrder, summarizeChanges } from "@/lib/planograms/diff";
import { planogramOwner, planogramScope } from "@/lib/planograms/faces";
import { listVersions, loadPlanogram } from "@/lib/planograms/queries";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { activeStoreId } = await requireMember();
  const { fixtureId } = await params;
  if (!z.uuid().safeParse(fixtureId).success) notFound();
  const layout = await loadLayout(activeStoreId);
  const owner = planogramOwner(layout, fixtureId);
  if (!owner) notFound();
  if (owner.id !== fixtureId) redirect(`/planograms/${owner.id}/history`);
  const scope = planogramScope(layout, owner.id);
  const { row } = await loadPlanogram(activeStoreId, owner.id);
  if (!scope || !row) notFound();

  const faceIds = scope.faces.map((f) => f.faceId);
  const versions = await listVersions(activeStoreId, row.id);
  const entries: HistoryEntry[] = versions.map((v, i) => ({
    number: v.number,
    publishedAt: v.publishedAt,
    publishedByName: v.publishedByName,
    summary: v.summary,
    changeText: summarizeChanges(sortByFaceOrder(diffPlacements(versions[i + 1]?.placements ?? [], v.placements), faceIds)),
    gone: goneFaces(v.placements, scope.faces),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title="History" back={{ href: `/planograms/${owner.id}`, label: scope.fixtureName }} />
      {entries.length === 0 ? <p className="text-ink-muted">Nothing published yet.</p> : <HistoryList fixtureId={owner.id} expectedVersion={row.version} entries={entries} />}
    </div>
  );
}

// Quick Adjust (0.7.0.9 spec §5.1): replace a sold-out or on-sale tile of the published planogram with something in stock,
// or leave it empty, then compare and publish. For those who may draft; with no published version there is nothing to adjust.
// ?product=<id> selects that product's first tile and opens its panel.

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { QuickAdjustScreen } from "@/components/quick-adjust/quick-adjust-screen";
import { PageHeader } from "@/components/shell/page-header";
import { requireSwitch } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { planogramOwner, planogramScope } from "@/lib/planograms/faces";
import { productLooks } from "@/lib/planograms/product-looks";
import { loadPlanogram } from "@/lib/planograms/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ fixtureId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdjustPage({ params, searchParams }: Params) {
  const member = await requireSwitch("planograms.draft");
  const { activeStoreId } = member;
  const { fixtureId } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(fixtureId).success) notFound();

  const layout = await loadLayout(activeStoreId);
  const owner = planogramOwner(layout, fixtureId);
  if (!owner) notFound();
  if (owner.id !== fixtureId) {
    const rest = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    redirect(`/planograms/${owner.id}/adjust${rest.size ? `?${rest}` : ""}`);
  }
  const scope = planogramScope(layout, owner.id);
  if (!scope || scope.faces.length === 0) notFound();

  const state = await loadPlanogram(activeStoreId, owner.id, true);
  // Nothing published, nothing to adjust.
  if (!state.row || !state.latest || state.row.publishedVersion === null) notFound();
  const { draft, published } = state.adjustments;
  const replacements = [draft, published].flatMap((adjustment) => (adjustment?.changes ?? []).flatMap((c) => (c.kind === "replace" ? [c.replacement.productId] : [])));
  const looks = await productLooks(activeStoreId, [...state.latest.placements.map((p) => p.productId), ...replacements]);
  const product = typeof query.product === "string" && z.uuid().safeParse(query.product).success ? query.product : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title={scope.fixtureName} back={{ href: `/planograms/${owner.id}`, label: "Planogram" }} />
      <QuickAdjustScreen
        // A draft opened, ended or discarded elsewhere reloads this page: start over from what it reads.
        key={`${state.latest.number}-${draft?.id ?? "none"}-${published?.id ?? "none"}`}
        scope={scope}
        version={state.latest}
        draft={draft}
        published={published}
        looks={looks}
        productId={product}
        member={member}
      />
    </div>
  );
}

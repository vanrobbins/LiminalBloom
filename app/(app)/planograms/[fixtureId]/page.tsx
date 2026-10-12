// Planogram Detail (spec §5.2): the published planogram, the draft, or a past
// version (?version=K), face by face; ?product=<id> highlights a product.

import { History } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PlanogramScreen } from "@/components/planograms/planogram-screen";
import { VersionLine } from "@/components/planograms/version-line";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { todayIso } from "@/lib/planograms/dates";
import { planogramOwner, planogramScope } from "@/lib/planograms/faces";
import { productLooks } from "@/lib/planograms/product-looks";
import { loadPlanogram, loadVersion } from "@/lib/planograms/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ fixtureId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PlanogramPage({ params, searchParams }: Params) {
  const { activeStoreId } = await requireMember();
  const { fixtureId } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(fixtureId).success) notFound();

  const layout = await loadLayout(activeStoreId);
  const owner = planogramOwner(layout, fixtureId);
  if (!owner) notFound();
  if (owner.id !== fixtureId) {
    const rest = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    redirect(`/planograms/${owner.id}${rest.size ? `?${rest}` : ""}`);
  }
  const scope = planogramScope(layout, owner.id);
  if (!scope || scope.faces.length === 0) notFound();

  const state = await loadPlanogram(activeStoreId, owner.id);
  const versionNumber = z.coerce.number().int().min(1).safeParse(query.version);
  const viewing = versionNumber.success && state.row ? await loadVersion(activeStoreId, state.row.id, versionNumber.data) : null;
  const looks = await productLooks(activeStoreId, [...(state.latest?.placements ?? []), ...(viewing?.placements ?? [])].map((p) => p.productId));
  const product = typeof query.product === "string" && z.uuid().safeParse(query.product).success ? query.product : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        title={scope.fixtureName}
        back={{ href: "/planograms", label: "Planograms" }}
        actions={
          state.row?.publishedVersion ? (
            <Button asChild variant="secondary" icon>
              <Link href={`/planograms/${owner.id}/history`} aria-label="History">
                <History aria-hidden="true" strokeWidth={1.75} className="size-5" />
              </Link>
            </Button>
          ) : null
        }
      />
      <VersionLine latest={state.latest} />
      <PlanogramScreen
        key={`${state.row?.version ?? 0}-${viewing?.number ?? 0}`}
        scope={scope}
        row={state.row}
        latest={state.latest}
        draft={state.draft}
        viewing={viewing}
        looks={looks}
        highlightProductId={product}
        dueDate={state.row?.dueDate ?? null}
        today={todayIso()}
      />
    </div>
  );
}

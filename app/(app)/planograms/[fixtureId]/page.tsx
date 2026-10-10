// Planogram Detail (spec §5.2): the published planogram, the draft, or a past
// version (?version=K), face by face; ?product=<id> highlights a product.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { DueDateField } from "@/components/planograms/due-date-field";
import { PlanogramScreen } from "@/components/planograms/planogram-screen";
import { VersionLine } from "@/components/planograms/version-line";
import { requireMember } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { planogramOwner, planogramScope } from "@/lib/planograms/faces";
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
  const product = typeof query.product === "string" && z.uuid().safeParse(query.product).success ? query.product : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link href="/planograms" className="inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:underline">
        ← Planograms
      </Link>
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink wrap-anywhere">{scope.fixtureName}</h1>
          <VersionLine latest={state.latest} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DueDateField key={state.row?.dueDate ?? "none"} fixtureId={owner.id} dueDate={state.row?.dueDate ?? null} />
          {state.row?.publishedVersion ? (
            <Link href={`/planograms/${owner.id}/history`} className="inline-flex min-h-11 items-center text-brand-strong underline underline-offset-4">
              History
            </Link>
          ) : null}
        </div>
      </header>
      <PlanogramScreen
        key={`${state.row?.version ?? 0}-${viewing?.number ?? 0}`}
        scope={scope}
        row={state.row}
        latest={state.latest}
        draft={state.draft}
        viewing={viewing}
        highlightProductId={product}
      />
    </div>
  );
}

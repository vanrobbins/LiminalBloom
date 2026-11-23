// /admin/stores/[id] (spec 0.7.1 7.3): one store's people (name, email, role), pending invitations and pause.
// The help actions (Make Store Manager, Cancel invitation, Pause, Restore) are added by the help-actions task.

import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { PausedBadge } from "@/components/admin/paused-badge";
import { StorePeople } from "@/components/admin/store-people";
import { LocalTime } from "@/components/time/local-time";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { storeDetail } from "@/lib/admin/reads";

export const dynamic = "force-dynamic";

export default async function AdminStorePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const store = await storeDetail((await params).id);
  if (!store) notFound();
  return (
    <>
      <Link href="/admin/stores" className="inline-flex min-h-11 items-center gap-2 self-start text-ink-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Stores
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink wrap-break-word md:text-3xl">{store.name}</h1>
        {store.pause ? <PausedBadge /> : null}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="facts" className="flex flex-col gap-4">
          <h2 id="facts" className="text-lg font-semibold text-ink">Details</h2>
          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-ink-muted">Created</dt>
              <dd className="text-ink">
                <LocalTime at={store.createdAt} />
              </dd>
            </div>
            {store.pause ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-ink-muted">Paused</dt>
                <dd className="wrap-break-word text-ink">
                  <LocalTime at={store.pause.since} /> by {store.pause.byName}: {store.pause.reason}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
        <StorePeople store={store} />
      </div>
    </>
  );
}

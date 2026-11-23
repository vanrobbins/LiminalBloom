// /admin: what needs an admin now (spec 0.7.1 7.3). Help waiting and the last 10 things done. The requests card
// waits for 0.7.1b, and the help count links to the queue once /admin/help exists (A8).

import { LifeBuoy } from "lucide-react";
import Link from "next/link";

import { EventList } from "@/components/admin/event-list";
import { Card } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { adminOverview } from "@/lib/admin/reads";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const { helpWaiting, events } = await adminOverview();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Overview</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card compact>
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <LifeBuoy aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
            Help waiting
          </h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{helpWaiting}</p>
        </Card>
      </div>
      <section aria-labelledby="recent" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent" className="text-lg font-semibold text-ink">
            Recent activity
          </h2>
          <Link href="/admin/activity" className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            All activity
          </Link>
        </div>
        <EventList events={events} />
      </section>
    </>
  );
}

// /admin/activity (spec 0.7.1 7.3): platform_events, newest first, 50 at a time (Show more), filtered by kind.

import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { ActivityFilter } from "@/components/admin/activity-filter";
import { EventList, EventTable } from "@/components/admin/event-list";
import { Button } from "@/components/ui/button";
import { activityParams, showMoreHref } from "@/lib/admin/activity-params";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { recentEvents } from "@/lib/admin/reads";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin();
  const params = activityParams(await searchParams);
  const { events, hasMore } = await recentEvents(params);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Activity</h1>
      <ActivityFilter kind={params.kind} />
      <div className="lg:hidden">
        <EventList events={events} />
      </div>
      <div className="hidden lg:block">
        <EventTable events={events} />
        {events.length === 0 ? <p className="text-ink-muted">Nothing has been done yet.</p> : null}
      </div>
      {hasMore ? (
        <Button asChild variant="secondary" className="self-start">
          <Link href={showMoreHref(params)}>
            <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Show more
          </Link>
        </Button>
      ) : null}
    </>
  );
}

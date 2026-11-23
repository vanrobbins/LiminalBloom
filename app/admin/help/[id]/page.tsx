// /admin/help/[id] (spec 0.7.1 9.2): one request. The thread, the Context card, Reply (sent as Liminal Bloom) and
// Close. A closed request shows who closed it and takes no reply.

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminReplyForm, CloseHelp } from "@/components/admin/help-admin-actions";
import { AdminHelpThread, HelpContextCard } from "@/components/admin/help-admin-thread";
import { HelpStatusWord } from "@/components/help/help-status";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { adminHelpThread } from "@/lib/admin/help-reads";
import { KIND_LABEL } from "@/lib/help/kinds";

export const dynamic = "force-dynamic";

export default async function AdminHelpThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const thread = await adminHelpThread((await params).id);
  if (!thread) notFound();
  const isClosed = thread.status === "closed";
  return (
    <>
      <Link href="/admin/help" className="inline-flex min-h-11 items-center gap-2 self-start text-ink-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Help
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-ink wrap-break-word md:text-3xl">{KIND_LABEL[thread.kind]}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <HelpStatusWord status={thread.status} />
        {isClosed ? <span className="text-sm text-ink-muted">{`Closed by ${thread.closedBy === "admin" ? "Liminal Bloom" : thread.requesterName}`}</span> : <CloseHelp id={thread.id} name={thread.requesterName} />}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <AdminHelpThread messages={thread.messages} />
          {isClosed ? null : <AdminReplyForm id={thread.id} />}
        </div>
        <HelpContextCard name={thread.requesterName} email={thread.requesterEmail} context={thread.context} />
      </div>
    </>
  );
}

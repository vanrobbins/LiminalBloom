// /admin/requests/[id] (spec 0.7.1 5.3): one company request. Who asked and where they stand today, the request's
// messages, and for a waiting one Approve, Reject (reason required, shown to the person) and Ask a question. An
// owner can't be approved until they hand their company off, so Approve is not offered and the page says who to wait on.

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminHelpThread } from "@/components/admin/help-admin-thread";
import { RequestStatusWord } from "@/components/admin/request-list";
import { ApproveRequest, AskQuestionForm, RejectRequest } from "@/components/admin/request-actions";
import { DecisionNote, RequesterCard } from "@/components/admin/request-facts";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { adminRequestDetail } from "@/lib/admin/request-reads";

export const dynamic = "force-dynamic";

export default async function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const request = await adminRequestDetail((await params).id);
  if (!request) notFound();
  const { requester, thread } = request;
  const isPending = request.status === "pending";
  const owns = requester.company?.role === "owner" ? requester.company : null;
  const target = { id: request.id, version: request.version, name: request.name, requesterName: requester.name };
  return (
    <>
      <Link href="/admin/requests" className="inline-flex min-h-11 items-center gap-2 self-start text-ink-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Company requests
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-ink wrap-break-word md:text-3xl">{request.name}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <RequestStatusWord status={request.status} />
        {isPending ? (
          <div className="flex flex-wrap gap-2">
            {owns ? null : <ApproveRequest {...target} leaving={requester.company?.name ?? null} />}
            <RejectRequest {...target} />
          </div>
        ) : null}
      </div>
      {owns ? <p className="text-ink">{`Waiting on ${requester.name} to hand off ${owns.name}. Approve is offered once they have.`}</p> : null}
      <DecisionNote request={request} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          {thread ? (
            <>
              <h2 className="text-lg font-semibold text-ink">Messages</h2>
              <AdminHelpThread messages={thread.messages} />
              <Link href={`/admin/help/${thread.id}`} className="inline-flex min-h-11 items-center self-start text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                Open in Help
              </Link>
            </>
          ) : null}
          {isPending ? <AskQuestionForm id={request.id} requesterName={requester.name} hasThread={thread !== null && thread.status !== "closed"} /> : null}
        </div>
        <RequesterCard requester={requester} />
      </div>
    </>
  );
}

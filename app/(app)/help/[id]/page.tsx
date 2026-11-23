// /help/[id] (spec 0.7.1 9.2): one of my threads. A request that is not mine is a 404, the same as one that
// does not exist: getThread filters by the person's id. Close sits beside the status; a closed thread says so
// and offers Ask again; opening a thread with a reply in it marks it seen.

import { notFound } from "next/navigation";

import { AskButton } from "@/components/help/ask-button";
import { CloseButton } from "@/components/help/close-button";
import { HelpFrame } from "@/components/help/help-frame";
import { HelpStatusWord } from "@/components/help/help-status";
import { HelpThread } from "@/components/help/help-thread";
import { ReplyForm } from "@/components/help/reply-form";
import { SeenMark } from "@/components/help/seen-mark";
import { Card } from "@/components/ui/card";
import { requireSignedIn } from "@/lib/current-member";
import { KIND_LABEL } from "@/lib/help/kinds";
import { getThread } from "@/lib/help/queries";

export const dynamic = "force-dynamic";

export default async function HelpThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await requireSignedIn(`/help/${encodeURIComponent(id)}`);
  const thread = await getThread(current.user.id, id);
  if (!thread) notFound();
  const isClosed = thread.status === "closed";

  return (
    <HelpFrame kind={current.kind} title={KIND_LABEL[thread.kind]} back={{ href: "/help", label: "Help" }}>
      <div className="flex items-center justify-between gap-3">
        <HelpStatusWord status={thread.status} />
        {isClosed ? null : <CloseButton id={thread.id} />}
      </div>
      <HelpThread messages={thread.messages} />
      {isClosed ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-ink">Closed. Ask again if you still need help.</p>
          <AskButton />
        </Card>
      ) : (
        <ReplyForm id={thread.id} sticky={current.kind === "member"} />
      )}
      {thread.unread ? <SeenMark id={thread.id} /> : null}
    </HelpFrame>
  );
}

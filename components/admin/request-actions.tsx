// What an admin does with a waiting company request (spec 0.7.1 5.3): Approve and Reject, each a reason dialog
// pinned to the version the admin is looking at, and Ask a question, which opens or continues the request's help
// thread. Approve and Reject toast when they finish (R2: the page changes under the admin); a refusal shows
// inline in the dialog and a question's refusal beside the field.

"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { approveRequestAction, askQuestionAction, rejectRequestAction } from "@/app/admin/requests/actions";
import { NETWORK_TEXT } from "@/components/people/refusal-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_BODY } from "@/lib/help/limits";
import { replyText } from "@/lib/admin/replies";

import { AdminAction } from "./admin-action";

type Target = { id: string; version: number; name: string; requesterName: string };

export function ApproveRequest({ id, version, name, requesterName, leaving }: Target & { leaving: string | null }) {
  return (
    <AdminAction
      label="Approve"
      icon={Check}
      buttonVariant="primary"
      title={`Approve ${name}?`}
      description={`${requesterName} becomes the owner of ${name}.${leaving ? ` They leave ${leaving} and lose access to its stores and people; any store of their own stays theirs.` : ""}`}
      confirm="Approve"
      loadingText="Approving…"
      doneToast="Company approved."
      run={(reason) => approveRequestAction(id, version, reason)}
    />
  );
}

export function RejectRequest({ id, version, name, requesterName }: Target) {
  return (
    <AdminAction
      label="Reject"
      icon={X}
      title={`Reject ${name}?`}
      description={`${requesterName} sees your reason and can ask Liminal Bloom about it or request again.`}
      hint="Shown to the person who asked. 5 to 500 characters."
      confirm="Reject"
      loadingText="Rejecting…"
      variant="danger"
      doneToast="Request rejected."
      run={(reason) => rejectRequestAction(id, version, reason)}
    />
  );
}

export function AskQuestionForm({ id, requesterName, hasThread }: { id: string; requesterName: string; hasThread: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [sent, setSent] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isBusy || body.trim() === "") return;
    setIsBusy(true);
    setProblem(null);
    setSent("");
    try {
      const reply = await askQuestionAction(id, body);
      if (reply.status === "done") {
        setBody("");
        setSent("Question sent.");
        field.current?.focus();
        router.refresh();
      } else {
        setProblem(replyText(reply.status).message);
        if (reply.status === "not-pending" || reply.status === "gone") router.refresh();
      }
    } catch {
      setProblem(NETWORK_TEXT);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-line-subtle bg-raised p-4">
      <Textarea ref={field} label={hasThread ? "Ask another question" : "Ask a question"} hint={`Sent to ${requesterName} as Liminal Bloom, in their request's messages. They never see your name.`} rows={3} value={body} maxLength={MAX_BODY} autoComplete="off" onChange={(e) => setBody(e.target.value)} error={problem ?? undefined} />
      <p role="status" className="sr-only">
        {sent}
      </p>
      <Button type="submit" className="self-start" loading={isBusy} loadingText="Sending…" disabled={body.trim() === ""}>
        Send question
      </Button>
    </form>
  );
}

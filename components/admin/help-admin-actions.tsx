// Reply and Close on an admin's thread (spec 0.7.1 7.4, 9.2). Reply sends as Liminal Bloom and says so under the
// field; a refusal shows beside it. Close is a reason dialog (the reason goes in the admin log).

"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { adminCloseHelpAction, adminReplyHelpAction } from "@/app/admin/help/actions";
import { NETWORK_TEXT } from "@/components/people/refusal-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_BODY, REFUSAL_TEXT } from "@/lib/help/limits";

import { AdminAction } from "./admin-action";

const FORBIDDEN = "Your admin access needs a fresh check. Reload the page and verify again.";

export function AdminReplyForm({ id }: { id: string }) {
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
      const reply = await adminReplyHelpAction(id, body);
      if (reply.status === "done") {
        setBody("");
        setSent("Reply sent.");
        field.current?.focus();
        router.refresh();
      } else if (reply.status === "forbidden") {
        setProblem(FORBIDDEN);
      } else if (reply.status === "already") {
        setProblem("That has already changed. Reload the page.");
      } else {
        setProblem(REFUSAL_TEXT[reply.status]);
        if (reply.status === "closed" || reply.status === "gone") router.refresh();
      }
    } catch {
      setProblem(NETWORK_TEXT);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-line-subtle bg-raised p-4">
      <Textarea ref={field} label="Reply" hint="Sent as Liminal Bloom. The person never sees your name." rows={3} value={body} maxLength={MAX_BODY} autoComplete="off" onChange={(e) => setBody(e.target.value)} error={problem ?? undefined} />
      <p role="status" className="sr-only">
        {sent}
      </p>
      <Button type="submit" className="self-start" loading={isBusy} loadingText="Sending…" disabled={body.trim() === ""}>
        Send reply
      </Button>
    </form>
  );
}

export function CloseHelp({ id, name }: { id: string; name: string }) {
  return (
    <AdminAction
      label="Close"
      icon={CircleCheck}
      title="Close this request?"
      description={`${name} can't reply to it any more. They can ask again if they still need help.`}
      confirm="Close request"
      loadingText="Closing…"
      doneToast="Request closed."
      messages={{ already: "That request is already closed. Close and look again." }}
      run={(reason) => adminCloseHelpAction(id, reason)}
    />
  );
}

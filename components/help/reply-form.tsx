// Reply to a thread (spec 0.7.1 9.2). On a phone inside the shell it sticks above the tab bar, under the thread.
// A refusal shows beside the field; a lost connection is the one toast.

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { replyHelpAction } from "@/app/(app)/help/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_BODY, REFUSAL_TEXT } from "@/lib/help/limits";

import { useHelpCall } from "./use-help-call";

export function ReplyForm({ id, sticky }: { id: string; sticky: boolean }) {
  const router = useRouter();
  const { isBusy, call } = useHelpCall();
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isBusy || body.trim() === "") return;
    setProblem(null);
    setSent(false);
    const reply = await call(() => replyHelpAction(id, body));
    if (!reply) return;
    if (reply.status === "done") {
      setBody("");
      setSent(true);
      field.current?.focus();
      router.refresh();
      return;
    }
    setProblem(REFUSAL_TEXT[reply.status]);
    // A thread that closed or filled up meanwhile: show it as it is now.
    if (reply.status === "closed" || reply.status === "gone") router.refresh();
  }

  return (
    <form onSubmit={submit} className={`flex flex-col gap-3 rounded-lg border border-line-subtle bg-raised p-4 ${sticky ? "sticky bottom-20 z-20 md:static" : ""}`.trim()}>
      <Textarea ref={field} label="Reply" rows={3} value={body} maxLength={MAX_BODY} autoComplete="off" onChange={(e) => setBody(e.target.value)} error={problem ?? undefined} />
      <p role="status" className="sr-only">
        {sent ? "Reply sent" : ""}
      </p>
      <Button type="submit" className="self-start" loading={isBusy} loadingText="Sending…" disabled={body.trim() === ""}>
        Send
      </Button>
    </form>
  );
}

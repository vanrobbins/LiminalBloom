// Ask Liminal Bloom (spec 0.7.1 9.2): what it is about, a message, Send. Sending opens the new thread. The form
// sends only the kind, the message and the screen it came from; the context (store, role, account) is attached
// on the server. A refusal shows under the field it is about; a lost connection is the one toast.

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { openHelpAction } from "@/app/(app)/help/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type HelpKind, KIND_LABEL } from "@/lib/help/kinds";
import { MAX_BODY, MIN_FIRST_BODY, REFUSAL_TEXT } from "@/lib/help/limits";

import { useHelpCall } from "./use-help-call";

type Props = { kinds: readonly HelpKind[]; initialKind: HelpKind; from: string | null };

export function HelpForm({ kinds, initialKind, from }: Props) {
  const router = useRouter();
  const { isBusy, call } = useHelpCall();
  const [kind, setKind] = useState<HelpKind>(initialKind);
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState<{ field: "kind" | "body" | "form"; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const isLongEnough = body.trim().length >= MIN_FIRST_BODY;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isBusy || !isLongEnough) return;
    setProblem(null);
    setSent(false);
    const reply = await call(() => openHelpAction({ kind, body, from }));
    if (!reply) return;
    if (reply.status === "done" && reply.id) {
      setSent(true);
      field.current?.focus();
      router.push(`/help/${reply.id}`);
      return;
    }
    if (reply.status === "done") return;
    setProblem({ field: reply.status === "invalid-kind" ? "kind" : reply.status === "invalid-body" ? "body" : "form", text: REFUSAL_TEXT[reply.status] });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm text-ink">What is this about?</legend>
        {kinds.map((k) => (
          <label key={k} className="flex min-h-11 items-center gap-3 rounded text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="size-5 shrink-0 accent-(--ink)" />
            {KIND_LABEL[k]}
          </label>
        ))}
        {problem?.field === "kind" ? <p className="text-sm text-danger">{problem.text}</p> : null}
      </fieldset>
      <Textarea
        ref={field}
        label="Message"
        hint="Liminal Bloom can't see your store's products, map or planograms, so describe what you see. Never send a password."
        value={body}
        maxLength={MAX_BODY}
        required
        autoComplete="off"
        onChange={(e) => setBody(e.target.value)}
        error={problem?.field === "body" ? problem.text : undefined}
      />
      <p role="status" className="text-sm text-danger empty:hidden">
        {problem?.field === "form" ? problem.text : null}
      </p>
      <p role="status" className="sr-only">
        {sent ? "Request sent" : ""}
      </p>
      <Button type="submit" loading={isBusy} loadingText="Sending…" disabled={!isLongEnough}>
        Send
      </Button>
    </form>
  );
}

// The request form (spec 0.7.1 5.1): one field, the company name (2 to 60), and Send request. A person already
// in a company is asked first, in the hand-off's words: the new company moves them out of the old one. A refusal
// shows under the field; a lost connection is the one toast. On success the page refreshes into the waiting card.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendCompanyRequestAction } from "@/app/(app)/request-company/actions";
import { useHelpCall } from "@/components/help/use-help-call";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cleanCompanyName, MAX_COMPANY_NAME, SEND_REFUSAL_TEXT } from "@/lib/companies/request-rules";

export function RequestForm({ currentCompany }: { currentCompany: string | null }) {
  const router = useRouter();
  const { isBusy, call } = useHelpCall();
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const cleaned = cleanCompanyName(name);

  async function send() {
    setProblem(null);
    const reply = await call(() => sendCompanyRequestAction(name));
    setIsAsking(false);
    if (!reply) return;
    if (reply.status === "done") {
      router.refresh();
      return;
    }
    setProblem(SEND_REFUSAL_TEXT[reply.status]);
    if (reply.status !== "invalid-name") router.refresh();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isBusy || !cleaned) return;
    if (currentCompany) setIsAsking(true);
    else void send();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Company name" hint="For a chain with several stores. Liminal Bloom approves each company." value={name} maxLength={MAX_COMPANY_NAME} autoComplete="organization" required error={problem ?? undefined} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" loading={isBusy && !isAsking} loadingText="Sending…" disabled={!cleaned}>
        Send request
      </Button>
      {isAsking && cleaned ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setIsAsking(false)}
          title="Request a new company?"
          description={`Requesting ${cleaned} will move you out of ${currentCompany} once Liminal Bloom approves it. You will become the owner of ${cleaned} and will lose access to ${currentCompany}'s stores and people. Other corporate admins can add you back later.`}
        >
          <div className="flex flex-col gap-2">
            <Button loading={isBusy} loadingText="Sending…" onClick={send}>
              Send request
            </Button>
            <Button variant="secondary" disabled={isBusy} onClick={() => setIsAsking(false)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      ) : null}
    </form>
  );
}

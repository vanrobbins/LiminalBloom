// The "Company request" card (spec 0.7.1 5.2), on /welcome, Account and /request-company: a waiting request with
// Withdraw (and the way into its thread when Liminal Bloom asked something), or a rejection with the reason, Ask
// Liminal Bloom and Request again. An approved request shows no card: the person is an owner then.

import { MessageCircleQuestionMark } from "lucide-react";
import Link from "next/link";

import { AskButton } from "@/components/help/ask-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RequestCard as Card_ } from "@/lib/companies/request-reads";

import { WithdrawButton } from "./withdraw-button";

type Props = { card: Card_; /** On /request-company itself, the form is right below: no "Request again" link. */ onRequestPage?: boolean };

export function RequestCard({ card, onRequestPage = false }: Props) {
  return (
    <Card compact className="flex flex-col gap-3 text-sm">
      <h2 className="font-medium text-ink">Company request</h2>
      {card.status === "pending" ? (
        <>
          <p className="text-ink">
            Your request for <strong className="font-semibold">{card.name}</strong> is waiting for Liminal Bloom.
          </p>
          {card.thread ? (
            <Link href={`/help/${card.thread.id}`} className="inline-flex min-h-11 items-center gap-2 self-start text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <MessageCircleQuestionMark aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
              {card.thread.answered ? "Liminal Bloom asked a question." : "See your messages"}
            </Link>
          ) : null}
          <div className="flex">
            <WithdrawButton id={card.id} name={card.name} />
          </div>
        </>
      ) : (
        <>
          <p className="text-ink">
            Liminal Bloom didn&apos;t approve <strong className="font-semibold">{card.name}</strong>
            {card.reason ? `: ${card.reason}` : "."}
          </p>
          <div className="flex flex-wrap gap-2">
            <AskButton kind="company_request" from="/request-company" />
            {onRequestPage ? null : (
              <Button asChild variant="secondary">
                <Link href="/request-company">Request again</Link>
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

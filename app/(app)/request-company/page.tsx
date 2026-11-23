// /request-company (spec 0.7.1 5.1): ask Liminal Bloom for a company. Guards with requireSignedIn, like Help: a
// person with no store needs it most, so it draws the bare card for them and the shell's page for a member. An
// owner is told to hand the company off first; a waiting request shows with Withdraw instead of the form.

import Link from "next/link";

import { RequestCard } from "@/components/company-request/request-card";
import { RequestForm } from "@/components/company-request/request-form";
import { HelpFrame } from "@/components/help/help-frame";
import { requestCardFor, standingCompanyOf } from "@/lib/companies/request-reads";
import { requireSignedIn } from "@/lib/current-member";

export const dynamic = "force-dynamic";

export default async function RequestCompanyPage() {
  const current = await requireSignedIn("/request-company");
  const [card, standing] = await Promise.all([requestCardFor(current.user.id), standingCompanyOf(current.user.id)]);
  return (
    <HelpFrame kind={current.kind} title="Request a company" back={current.kind === "member" ? { href: "/account", label: "Account" } : undefined}>
      {standing?.role === "owner" ? (
        <p className="text-ink">
          You own {standing.name}. Hand it to a corporate admin first.{" "}
          <Link href="/company#ownership" className="text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            Go to Ownership
          </Link>
        </p>
      ) : card?.status === "pending" ? (
        <RequestCard card={card} onRequestPage />
      ) : (
        <>
          {card ? <RequestCard card={card} onRequestPage /> : null}
          <RequestForm currentCompany={standing?.name ?? null} />
        </>
      )}
    </HelpFrame>
  );
}

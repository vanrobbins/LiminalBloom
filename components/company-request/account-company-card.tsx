// Account's "Company" card (spec 0.7.1 10): the company they are in and their role (a link to /company for the
// people who have the page), the request card when one is waiting or was rejected, or the way to ask for one.

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RequestCard as RequestCardData, StandingCompany } from "@/lib/companies/request-reads";

import { RequestCard } from "./request-card";

const ROLE_TEXT: Record<StandingCompany["role"], string> = { owner: "Owner", corporate_admin: "Corporate admin", regional_manager: "Regional manager", member: "Works in its stores" };

export function AccountCompanyCard({ standing, card }: { standing: StandingCompany | null; card: RequestCardData | null }) {
  return (
    <>
      <Card compact className="flex flex-col gap-3 text-sm">
        <h2 className="font-medium text-ink">Company</h2>
        {standing ? (
          <p className="text-ink">
            <span className="wrap-break-word font-semibold">{standing.name}</span>
            <span className="text-ink-muted"> · {ROLE_TEXT[standing.role]}</span>
          </p>
        ) : (
          <p className="text-ink-muted">You&apos;re not part of a company.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {standing && standing.role !== "member" ? (
            <Button asChild variant="secondary">
              <Link href="/company">Open company</Link>
            </Button>
          ) : null}
          {card || standing?.role === "owner" ? null : (
            <Button asChild variant="secondary">
              <Link href="/request-company">{standing ? "Request a new company" : "Request a company"}</Link>
            </Button>
          )}
        </div>
      </Card>
      {card ? <RequestCard card={card} /> : null}
    </>
  );
}

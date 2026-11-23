// The facts on a company request page (spec 0.7.1 5.3): the person's account (name, email, created, the company
// they are in now, their stores with roles) and, once decided, what was decided and why. Account-level facts only.

import { LocalTime } from "@/components/time/local-time";
import { Card } from "@/components/ui/card";
import type { AdminRequestDetail } from "@/lib/admin/request-reads";

const ROLE: Record<NonNullable<AdminRequestDetail["requester"]["company"]>["role"], string> = { owner: "owner", corporate_admin: "corporate admin", regional_manager: "regional manager", member: "member of its stores" };

export function RequesterCard({ requester }: { requester: AdminRequestDetail["requester"] }) {
  const lines: { label: string; value: React.ReactNode }[] = [
    { label: "Name", value: requester.name },
    { label: "Email", value: requester.email },
    { label: "Account created", value: <LocalTime at={requester.createdAt} /> },
    { label: "Company now", value: requester.company ? `${requester.company.name}, ${ROLE[requester.company.role]}` : "None" },
    { label: "Stores", value: requester.stores.length === 0 ? "None" : requester.stores.map((s) => (s.roleName ? `${s.name} (${s.roleName})` : s.name)).join(", ") },
  ];
  return (
    <Card compact>
      <h2 className="text-lg font-semibold text-ink">Who asked</h2>
      <dl className="mt-3 flex flex-col gap-3">
        {lines.map((l) => (
          <div key={l.label} className="flex flex-col gap-0.5">
            <dt className="text-sm text-ink-muted">{l.label}</dt>
            <dd className="text-ink wrap-break-word">{l.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function DecisionNote({ request }: { request: Pick<AdminRequestDetail, "status" | "decidedAt" | "decidedByName" | "reason"> }) {
  if (request.status === "pending") return null;
  const who = request.status === "withdrawn" ? "Withdrawn by the person who asked" : `${request.status === "approved" ? "Approved" : "Rejected"} by ${request.decidedByName ?? "an admin"}`;
  return (
    <p className="text-ink wrap-break-word">
      {who}, <LocalTime at={request.decidedAt} />.{request.reason ? ` Reason: ${request.reason}` : ""}
    </p>
  );
}

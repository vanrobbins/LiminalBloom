// Card 3, "Invitations waiting" (0.7.0.6 spec section 4): pending invitations in the People card's
// words, "Expires <moment>", "Expired <moment>" or "Lapsed". Rows are not links, because the actions
// live on People. It draws the emails it is given and nothing more: the loader sends rows only to
// someone who may manage people.

import { MailPlus } from "lucide-react";

import { LocalTime } from "@/components/time/local-time";
import { NO_ROLE_NAME } from "@/lib/access/people-view";
import type { InvitationRow } from "@/lib/home/types";

import { HomeCard } from "./home-card";

const SHOWN = 5;

function When({ row }: { row: InvitationRow }) {
  if (row.state === "lapsed") return <>Lapsed</>;
  return (
    <>
      {row.state === "expired" ? "Expired" : "Expires"} <LocalTime at={row.expiresAt} />
    </>
  );
}

export function WaitingInvitationsCard({ rows }: { rows: InvitationRow[] }) {
  return (
    <HomeCard title="Invitations waiting" icon={MailPlus} seeAll={{ href: "/people", page: "people", more: Math.max(0, rows.length - SHOWN) }}>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {rows.slice(0, SHOWN).map((row, n) => (
          <li key={row.id ?? `read-only-${n}`} className="flex min-h-11 flex-col justify-center py-2">
            <span className="font-medium text-ink wrap-break-word">{row.email}</span>
            <span className="text-sm text-ink-muted">
              {row.roleName === NO_ROLE_NAME ? row.roleName : `${row.roleName} role`} · <When row={row} />
            </span>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}

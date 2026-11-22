// Home's cards (0.7.0.6 spec sections 4 and 6): an async Server Component, so it can sit
// inside one Suspense. It loads what this viewer may see, then renders the cards that have
// something to say, in order, in a grid (one column on a phone, two from a tablet; a wide card
// adds `md:col-span-2` itself). If none do, one calm line.
//
// Each card is one `case` in `Card`. A card component takes its slice of `data` and renders its
// own `HomeCard`; it never re-checks the viewer's switches (`shownCards` already did).

import { requireMember } from "@/lib/current-member";
import { shownCards } from "@/lib/home/cards";
import { loadHome } from "@/lib/home/load";
import type { CardKey, HomeData } from "@/lib/home/types";

import { NotPlacedCard } from "./not-placed-card";
import { PlanogramWorkCard } from "./planogram-work-card";
import { RecentChangesCard } from "./recent-changes-card";
import { RecentPublishesCard } from "./recent-publishes-card";
import { SetupCard } from "./setup-card";
import { WaitingInvitationsCard } from "./waiting-invitations-card";

function Card({ cardKey, data }: { cardKey: CardKey; data: HomeData }) {
  switch (cardKey) {
    case "setup":
      return data.setup ? <SetupCard rows={data.setup} /> : null;
    case "invitations":
      return data.invitations ? <WaitingInvitationsCard rows={data.invitations} /> : null;
    case "changes":
      return data.changes ? <RecentChangesCard rows={data.changes} /> : null;
    case "planograms":
      return data.planograms ? <PlanogramWorkCard work={data.planograms} /> : null;
    case "notPlaced":
      return data.notPlaced ? <NotPlacedCard notPlaced={data.notPlaced} /> : null;
    case "published":
      return data.published ? <RecentPublishesCard rows={data.published} /> : null;
  }
}

export async function HomeCards() {
  const member = await requireMember();
  const data = await loadHome(member);
  const shown = shownCards(member, data);

  if (shown.length === 0) return <p className="text-ink-muted">Nothing needs you right now.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {shown.map((key) => (
        <Card key={key} cardKey={key} data={data} />
      ))}
    </div>
  );
}

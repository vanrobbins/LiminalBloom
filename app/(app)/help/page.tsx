// /help (spec 0.7.1 9.2, 9.3): my requests, newest first, and Ask Liminal Bloom. It guards with requireSignedIn:
// a person with no store, a missing two-step or only paused stores needs it most, so it draws the bare card
// for them and the shell's page for a member (the (app) layout draws the shell only for members).

import { AskButton } from "@/components/help/ask-button";
import { HelpFrame } from "@/components/help/help-frame";
import { HelpList } from "@/components/help/help-list";
import { requireSignedIn } from "@/lib/current-member";
import { listRequests } from "@/lib/help/queries";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const current = await requireSignedIn();
  const items = await listRequests(current.user.id);
  return (
    <HelpFrame kind={current.kind} title="Help">
      <div className="flex">
        <AskButton variant="primary" />
      </div>
      <HelpList items={items} />
    </HelpFrame>
  );
}

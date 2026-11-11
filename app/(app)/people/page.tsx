// People (spec 0.7, 4.8): everyone in the store by role. Reading it needs only
// `view`, which is membership, so every member can open it; what a viewer is sent
// (emails, invitations, which rows have buttons) is decided in lib/access/people.ts.
// Invite is offered only to someone who may invite into at least one role (`assignable`).

import { InviteControl } from "@/components/people/invite-control";
import { PeopleScreen } from "@/components/people/people-screen";
import { PageHeader } from "@/components/shell/page-header";
import { peopleViewFor } from "@/lib/access/people";
import { requireMember } from "@/lib/current-member";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const member = await requireMember();
  const view = await peopleViewFor(member);
  const storeName = member.stores.find((s) => s.id === member.activeStoreId)?.name ?? "this store";
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="People" actions={view.assignable.length > 0 ? <InviteControl roles={view.assignable} /> : null} />
      <PeopleScreen view={view} storeName={storeName} />
    </div>
  );
}

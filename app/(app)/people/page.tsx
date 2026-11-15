// People (spec 0.7, 4.8): everyone in the store by role. Reading it needs only
// `view`, which is membership, so every member can open it; what a viewer is sent
// (emails, invitations, which rows have buttons) is decided in lib/access/people.ts.
// Roles and permissions is linked only for someone who may manage roles (the page checks again).
// Invite is offered only to someone who may invite into at least one role (`assignable`).

import Link from "next/link";

import { InviteControl } from "@/components/people/invite-control";
import { PeopleScreen } from "@/components/people/people-screen";
import { PageHeader } from "@/components/shell/page-header";
import { peopleViewFor } from "@/lib/access/people";
import { can, requireMember } from "@/lib/current-member";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const member = await requireMember();
  const view = await peopleViewFor(member);
  const storeName = member.stores.find((s) => s.id === member.activeStoreId)?.name ?? "this store";
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="People" actions={view.assignable.length > 0 ? <InviteControl roles={view.assignable} /> : null} />
      {can(member, "roles.manage") ? (
        <p className="mb-6">
          <Link href="/roles" className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            Roles and permissions
          </Link>
        </p>
      ) : null}
      <PeopleScreen view={view} storeName={storeName} />
    </div>
  );
}

// The Store panel (0.7.0.7 spec section 6): the store's name and time zone, who works there, and, by
// switch, the tools to change them. Every member can open it (`requireMember`); what a viewer is sent
// is decided by the reads (`peopleViewFor` sends emails and invitations only to `people.manage`), and
// every action checks its switch again. Roles and permissions is its own page, `/store/roles`.

import { InviteControl } from "@/components/people/invite-control";
import { PeopleScreen } from "@/components/people/people-screen";
import { PageHeader } from "@/components/shell/page-header";
import { RolesLink } from "@/components/store/roles-link";
import { peopleViewFor } from "@/lib/access/people";
import { can, requireMember } from "@/lib/current-member";
import { storeSettingsFor } from "@/lib/store-settings";
import { DEFAULT_TIMEZONE } from "@/lib/time/zones";

import { StoreDetails } from "./store-details";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const member = await requireMember();
  const [settings, view] = await Promise.all([storeSettingsFor(member.activeStoreId), peopleViewFor(member)]);
  const storeName = member.stores.find((store) => store.id === member.activeStoreId)?.name ?? "Your store";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Store" actions={view.assignable.length > 0 ? <InviteControl roles={view.assignable} /> : null} />
      <StoreDetails name={storeName} zone={settings?.timezone ?? DEFAULT_TIMEZONE} version={settings?.version ?? 0} canManage={can(member, "store.settings")} />
      {can(member, "roles.manage") ? <RolesLink /> : null}
      <PeopleScreen view={view} storeName={storeName} />
    </div>
  );
}

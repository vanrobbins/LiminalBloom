// Store settings: the store's name and its time zone (DECISIONS "Time", 10-12), which
// decides what "today" and overdue mean for everyone working there. Only a
// role with the store.settings switch can change either; everyone else sees them.

import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { can, requireMember } from "@/lib/current-member";
import { storeSettingsFor } from "@/lib/store-settings";
import { DEFAULT_TIMEZONE, zoneLabel } from "@/lib/time/zones";

import { StoreNameForm } from "./store-name-form";
import { TimezoneForm } from "./timezone-form";
import { InfoPopover } from "@/components/ui/info-popover";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const member = await requireMember();
  const settings = await storeSettingsFor(member.activeStoreId);
  const canManage = can(member, "store.settings");
  const zone = settings?.timezone ?? DEFAULT_TIMEZONE;
  const storeName = member.stores.find((store) => store.id === member.activeStoreId)?.name ?? "Your store";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title="Store settings" back={{ href: "/account", label: "Account" }} />
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Store name</h2>
        <p className="text-sm text-ink-muted">Shown in the header and the store switcher, for everyone in the store.</p>
        {canManage ? (
          <StoreNameForm name={storeName} />
        ) : (
          <p className="text-ink wrap-break-word">
            {storeName}
            <span className="block text-sm text-ink-muted">Your role can&apos;t change this.</span>
          </p>
        )}
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="inline-flex items-center gap-1 text-lg font-semibold text-ink">
          Time zone
          <InfoPopover term="storeTime" />
        </h2>
        <p className="text-sm text-ink-muted">Due dates turn overdue at midnight here, wherever you are. Times like &ldquo;published at&rdquo; show in your own device&apos;s time.</p>
        {canManage ? (
          // Version 0 = no settings row yet; saving makes it.
          <TimezoneForm zone={zone} version={settings?.version ?? 0} />
        ) : (
          <p className="text-ink">
            {zoneLabel(zone)}
            <span className="block text-sm text-ink-muted">Your role can&apos;t change this.</span>
          </p>
        )}
      </Card>
    </div>
  );
}

// Store settings (DECISIONS "Time", 10-12): the store's time zone, which
// decides what "today" and overdue mean for everyone working there. Only the
// store's Better Auth owner or admins can change it (Week 7: the Admin role);
// everyone else sees it.

import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/current-member";
import { canManageStore, storeSettingsFor } from "@/lib/store-settings";
import { DEFAULT_TIMEZONE, zoneLabel } from "@/lib/time/zones";

import { TimezoneForm } from "./timezone-form";
import { InfoPopover } from "@/components/ui/info-popover";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const { user, activeStoreId } = await requireMember();
  const [settings, canManage] = await Promise.all([storeSettingsFor(activeStoreId), canManageStore(user.id, activeStoreId)]);
  const zone = settings?.timezone ?? DEFAULT_TIMEZONE;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title="Store settings" back={{ href: "/account", label: "Account" }} />
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
            <span className="block text-sm text-ink-muted">Only the store&apos;s owner or admins can change this.</span>
          </p>
        )}
      </Card>
    </div>
  );
}

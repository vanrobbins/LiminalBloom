// The Store panel's details card: the store's name and time zone (DECISIONS "Time", 10-12), which
// decides what "today" and overdue mean for everyone working there. With `store.settings` the two
// forms save as they change (R3, 0.7.0.5); everyone else reads them, with one line saying why not.

import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import { zoneLabel } from "@/lib/time/zones";

import { StoreNameForm } from "./store-name-form";
import { TimezoneForm } from "./timezone-form";

type StoreDetailsProps = { name: string; zone: string; version: number; canManage: boolean };

export function StoreDetails({ name, zone, version, canManage }: StoreDetailsProps) {
  return (
    <Card compact className="mb-6" role="region" aria-labelledby="store-details-heading">
      <h2 id="store-details-heading" className="mb-3 text-lg font-semibold text-ink">
        Store details
      </h2>
      {canManage ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <StoreNameForm name={name} />
            <p className="text-sm text-ink-muted">Shown in the header and the store switcher, for everyone in the store.</p>
          </div>
          <div className="flex flex-col gap-1">
            {/* Version 0 = no settings row yet; saving makes it. */}
            <TimezoneForm zone={zone} version={version} />
            <p className="inline-flex items-center gap-1 text-sm text-ink-muted">
              Due dates turn overdue at midnight here, wherever you are.
              <InfoPopover term="storeTime" />
            </p>
          </div>
        </div>
      ) : (
        <>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-sm text-ink-muted">Name</dt>
              <dd className="text-ink wrap-break-word">{name}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Time zone</dt>
              <dd className="inline-flex items-center gap-1 text-ink">
                {zoneLabel(zone)}
                <InfoPopover term="storeTime" />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-ink-muted">Your role can&apos;t change these.</p>
        </>
      )}
    </Card>
  );
}

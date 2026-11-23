// Add a store to the company and move one to another region (spec 0.7.1 6.2, 6.4). The server decides and
// refuses in words; a new store opens on its Home, where its Set up card waits.

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { moveStoreAction } from "@/app/(app)/company/actions";
import { addStoreAction } from "@/app/(app)/company/store-actions";
import { TimezonePicker } from "@/components/time/timezone-picker";
import { useDeviceTimezone } from "@/components/time/use-device-timezone";
import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import type { CompanyStoreRow, RegionRow } from "@/lib/companies/queries";
import { toast } from "@/lib/toast";
import { MAX_STORE_NAME } from "@/lib/store-name-limits";
import { startingZone } from "@/lib/time/zones";

import { ActionDialog } from "./action-dialog";

type Shared = { opener: HTMLElement | null; onClose: () => void; regions: RegionRow[] };

const NO_REGION = "";
const regionOrNull = (id: string) => (id === NO_REGION ? null : id);

function RegionSelect({ id, value, regions, onChange }: { id: string; value: string; regions: RegionRow[]; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-ink">
        Region
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASSES}>
        <option value={NO_REGION}>No region</option>
        {regions.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AddStoreDialog({ regions, ...shared }: Shared) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [region, setRegion] = useState(NO_REGION);
  // Prefilled from the device once it is known; keyed so the picker restarts on it.
  const device = startingZone(useDeviceTimezone());
  const [picked, setPicked] = useState<string | null>(null);
  const zone = picked ?? device;
  // Whether the session moved into the new store; if not, it exists, so the list reloads and a toast says so.
  const activeSet = useRef(true);

  return (
    <ActionDialog
      {...shared}
      title="Add a store"
      description="It joins the company with no Store Manager. Invite one from the store's own page."
      confirm="Add store"
      loadingText="Adding…"
      ready={name.trim().length >= 2}
      // The new store is the one this session works in: go to its Home. If the switch failed, stay and show it in the list.
      onDone={() => {
        if (activeSet.current) return router.push("/home");
        toast({ tone: "success", title: "Store added", description: "Switch to it from the account menu." });
        router.refresh();
      }}
      run={async () => {
        const reply = await addStoreAction(name, zone, regionOrNull(region));
        if (reply.status !== "added") return reply.message;
        activeSet.current = reply.activeSet;
        return null;
      }}
    >
      <Input label="Store name" value={name} maxLength={MAX_STORE_NAME} autoFocus autoComplete="off" onChange={(event) => setName(event.target.value)} />
      <TimezonePicker key={device} name="timezone" defaultZone={device} value={zone} onChange={setPicked} />
      <RegionSelect id="add-store-region" value={region} regions={regions} onChange={setRegion} />
    </ActionDialog>
  );
}

export function MoveStoreDialog({ store, regions, ...shared }: Shared & { store: CompanyStoreRow }) {
  const current = store.regionId ?? NO_REGION;
  const [region, setRegion] = useState(current);
  return (
    <ActionDialog
      {...shared}
      title={`Move ${store.name}`}
      confirm="Move store"
      loadingText="Moving…"
      ready={region !== current}
      run={async () => {
        const reply = await moveStoreAction(store.id, regionOrNull(region));
        return reply.status === "saved" ? null : reply.message;
      }}
    >
      <RegionSelect id="move-store-region" value={region} regions={regions} onChange={setRegion} />
    </ActionDialog>
  );
}

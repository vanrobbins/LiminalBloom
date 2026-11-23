// Add, rename and delete a region (spec 0.7.1 6.2, 6.3). The server decides; a delete of a region in use is
// explained here before it is asked, and refused again there.

"use client";

import { useState } from "react";

import { addRegionAction, deleteRegionAction, renameRegionAction } from "@/app/(app)/company/actions";
import { Input } from "@/components/ui/input";
import { MAX_REGION_NAME } from "@/lib/companies/limits";
import type { RegionRow } from "@/lib/companies/queries";

import { ActionDialog } from "./action-dialog";

type Shared = { opener: HTMLElement | null; onClose: () => void };

const problem = (reply: { status: string; message: string }) => (reply.status === "saved" ? null : reply.message);

export function AddRegionDialog(shared: Shared) {
  const [name, setName] = useState("");
  return (
    <ActionDialog {...shared} title="Add a region" confirm="Add region" loadingText="Adding…" ready={name.trim() !== ""} run={async () => problem(await addRegionAction(name))}>
      <Input label="Name" value={name} maxLength={MAX_REGION_NAME} autoFocus autoComplete="off" onChange={(event) => setName(event.target.value)} />
    </ActionDialog>
  );
}

export function RenameRegionDialog({ region, ...shared }: Shared & { region: RegionRow }) {
  const [name, setName] = useState(region.name);
  return (
    <ActionDialog
      {...shared}
      title={`Rename ${region.name}`}
      confirm="Save name"
      loadingText="Saving…"
      ready={name.trim() !== "" && name.trim() !== region.name}
      run={async () => problem(await renameRegionAction(region.id, name, region.name, region.version))}
    >
      <Input label="Name" value={name} maxLength={MAX_REGION_NAME} autoFocus autoComplete="off" onChange={(event) => setName(event.target.value)} />
    </ActionDialog>
  );
}

export function DeleteRegionDialog({ region, ...shared }: Shared & { region: RegionRow }) {
  const inUse = region.stores + region.managers > 0;
  return (
    <ActionDialog
      {...shared}
      title={`Delete ${region.name}?`}
      description={inUse ? `Move ${region.name}'s stores and regional managers first.` : "This can't be undone."}
      confirm="Delete region"
      loadingText="Deleting…"
      danger
      ready={!inUse}
      run={async () => problem(await deleteRegionAction(region.id))}
    />
  );
}

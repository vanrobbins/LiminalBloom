// /company's Regions (spec 0.7.1 6.2, 6.3). With `company.structure`: Add region, and Rename and Delete in each
// row's ⋯ menu; without it the rows are read-only. A regional manager is sent only their own region. Delete is
// offered always but explains itself while the region has stores or regional managers (the server refuses too).

"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import type { RegionRow } from "@/lib/companies/queries";

import { AddRegionDialog, DeleteRegionDialog, RenameRegionDialog } from "./region-dialogs";
import { RowMenu } from "./row-menu";

type Open = { kind: "add"; opener: HTMLElement | null } | { kind: "rename" | "delete"; region: RegionRow; opener: HTMLElement | null };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-4 shrink-0" } as const;

export function RegionsSection({ regions, canEdit }: { regions: RegionRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => setOpen(null);
  const shared = { opener: open?.opener ?? null, onClose: close };
  return (
    <Card compact role="region" aria-labelledby="company-regions-heading">
      <div className="mb-3 flex items-center gap-3">
        <h2 id="company-regions-heading" className="inline-flex flex-1 items-center gap-1 text-lg font-semibold text-ink">
          Regions
          <InfoPopover term="region" />
        </h2>
        {canEdit ? (
          <Button variant="secondary" onClick={(event) => setOpen({ kind: "add", opener: event.currentTarget })}>
            <Plus {...ICON} />
            Add region
          </Button>
        ) : null}
      </div>
      {regions.length === 0 ? (
        <p className="text-ink-muted">{canEdit ? "No regions yet. Add one to group your stores." : "No regions yet."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {regions.map((region) => (
            <li key={region.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 wrap-break-word text-ink">
                <span className="font-medium">{region.name}</span>
                <span className="text-ink-muted">
                  {" · "}
                  {plural(region.stores, "store")}
                  {" · "}
                  {plural(region.managers, "regional manager")}
                </span>
              </span>
              {canEdit ? (
                <RowMenu
                  name={region.name}
                  actions={[
                    { label: "Rename", icon: <Pencil {...ICON} />, run: (opener) => setOpen({ kind: "rename", region, opener }) },
                    { label: "Delete", icon: <Trash2 {...ICON} />, danger: true, run: (opener) => setOpen({ kind: "delete", region, opener }) },
                  ]}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {open?.kind === "add" ? <AddRegionDialog {...shared} /> : null}
      {open?.kind === "rename" ? <RenameRegionDialog {...shared} region={open.region} /> : null}
      {open?.kind === "delete" ? <DeleteRegionDialog {...shared} region={open.region} /> : null}
    </Card>
  );
}

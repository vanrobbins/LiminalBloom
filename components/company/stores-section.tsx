// /company's Stores (spec 0.7.1 6.2, 6.4): the company's stores grouped by region, then "No region". Each row's ⋯
// menu has Open (switches to the store and goes to its Home; for someone who has a store to be in) and, with
// `company.structure`, Move to region. Add store needs `company.structure` too. A paused store says so and is not
// opened: nobody reaches it until Liminal Bloom restores it.

"use client";

import { ArrowRightLeft, DoorOpen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSwitchStore } from "@/components/shell/use-switch-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CompanyStoreRow, RegionRow } from "@/lib/companies/queries";

import { RowMenu, type RowAction } from "./row-menu";
import { AddStoreDialog, MoveStoreDialog } from "./store-dialogs";

type Open = { kind: "add"; opener: HTMLElement | null } | { kind: "move"; store: CompanyStoreRow; opener: HTMLElement | null };

const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-4 shrink-0" } as const;

type StoresProps = {
  stores: CompanyStoreRow[];
  regions: RegionRow[];
  canEdit: boolean;
  /** The store this session works in, or null for a company person with no store yet (they cannot Open one). */
  activeStoreId: string | null;
};

export function StoresSection({ stores, regions, canEdit, activeStoreId }: StoresProps) {
  const router = useRouter();
  const { switchTo } = useSwitchStore(activeStoreId ?? "");
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => setOpen(null);

  async function openStore(id: string) {
    // Already the active store: only the page changes.
    if (id === activeStoreId || (await switchTo(id))) router.push("/home");
  }

  const actionsFor = (store: CompanyStoreRow): RowAction[] => [
    ...(activeStoreId !== null && !store.paused ? [{ label: "Open", icon: <DoorOpen {...ICON} />, run: () => void openStore(store.id) }] : []),
    ...(canEdit ? [{ label: "Move to region", icon: <ArrowRightLeft {...ICON} />, run: (opener: HTMLElement | null) => setOpen({ kind: "move", store, opener }) }] : []),
  ];

  const groups = [
    ...regions.map((region) => ({ key: region.id, name: region.name, rows: stores.filter((s) => s.regionId === region.id) })),
    { key: "none", name: "No region", rows: stores.filter((s) => s.regionId === null) },
  ].filter((group) => group.rows.length > 0);

  return (
    <Card compact role="region" aria-labelledby="company-stores-heading">
      <div className="mb-3 flex items-center gap-3">
        <h2 id="company-stores-heading" className="flex-1 text-lg font-semibold text-ink">
          Stores
        </h2>
        {canEdit ? (
          <Button variant="secondary" onClick={(event) => setOpen({ kind: "add", opener: event.currentTarget })}>
            <Plus {...ICON} />
            Add store
          </Button>
        ) : null}
      </div>
      {groups.length === 0 ? (
        <p className="text-ink-muted">{canEdit ? "No stores yet. Add the first one." : "No stores yet."}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`stores-${group.key}`}>
              <h3 id={`stores-${group.key}`} className="mb-1 text-sm text-ink-muted">
                {group.name} · {group.rows.length}
              </h3>
              <ul className="flex flex-col divide-y divide-line-subtle">
                {group.rows.map((store) => (
                  <li key={store.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 wrap-break-word text-ink">
                      {store.name}
                      {store.paused ? <span className="text-ink-muted"> · Paused by Liminal Bloom</span> : null}
                    </span>
                    <RowMenu name={store.name} actions={actionsFor(store)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {open?.kind === "add" ? <AddStoreDialog opener={open.opener} onClose={close} regions={regions} /> : null}
      {open?.kind === "move" ? <MoveStoreDialog opener={open.opener} onClose={close} regions={regions} store={open.store} /> : null}
    </Card>
  );
}

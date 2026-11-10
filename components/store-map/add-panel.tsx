// The one + Add on the floor plan (DECISIONS 11-09, A3): in the top bar at
// every size, and the panel opens out of the + itself. Areas and fixtures are
// grouped, each with a small shape (UX audit U11). Tapping a kind drops it in
// view, selected; on a mouse a kind can also be dragged onto the map. The
// panel is non-modal, so a drag can land on the map behind it.

"use client";

import { Popover } from "radix-ui";
import { Plus } from "lucide-react";

import { InfoPopover } from "@/components/ui/info-popover";
import type { Focus } from "@/lib/layout/hit-test";
import type { AddKind } from "@/lib/layout/session-core";

import { TILE_TYPE, addOptions } from "./add-options";
import { KindIcon } from "./kind-icon";

type AddPanelProps = {
  focus: Focus;
  onAdd: (kind: AddKind) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const AREAS: readonly AddKind[] = ["zone", "entrance"];

export function AddPanel({ focus, onAdd, open, onOpenChange }: AddPanelProps) {
  const options = addOptions(focus);
  const groups = [
    { title: "Areas", items: options.filter((o) => AREAS.includes(o.kind)) },
    { title: "Fixtures", items: options.filter((o) => !AREAS.includes(o.kind)) },
  ].filter((g) => g.items.length > 0);

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        type="button"
        data-add-trigger
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded bg-brand px-3 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-4"
      >
        <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
        Add
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Add to the map"
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-40 flex max-h-[min(32rem,calc(100dvh-6rem))] w-[min(22rem,calc(100vw-16px))] origin-(--radix-popover-content-transform-origin) flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-raised p-3 shadow-xl outline-none motion-safe:animate-grow-in"
        >
          {groups.map((group) => (
            <section key={group.title} aria-label={group.title} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-ink-muted">{group.title}</h2>
                {group.title === "Fixtures" ? <InfoPopover term="frameRack" /> : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map(({ kind, label }) => (
                  <button
                    key={kind}
                    type="button"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData(TILE_TYPE, kind)}
                    onDragEnd={() => onOpenChange(false)}
                    onClick={() => {
                      onAdd(kind);
                      onOpenChange(false);
                    }}
                    className="flex min-h-11 items-center gap-2 rounded border border-line bg-raised px-2 text-left text-sm text-ink hover:bg-line-subtle focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    <KindIcon kind={kind} />
                    {label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Phone: + Add opens a sheet of types (spec §7, approved mockup B).

"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { Focus } from "@/lib/layout/hit-test";
import type { AddKind } from "@/lib/layout/session-core";

import { addOptions } from "./add-options";

type AddSheetProps = { open: boolean; onOpenChange: (open: boolean) => void; focus: Focus; onAdd: (kind: AddKind) => void };

export function AddSheet({ open, onOpenChange, focus, onAdd }: AddSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Add to the map">
      <div className="grid grid-cols-2 gap-2">
        {addOptions(focus).map(({ kind, label }) => (
          <Button
            key={kind}
            variant="secondary"
            onClick={() => {
              onAdd(kind);
              onOpenChange(false);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </BottomSheet>
  );
}
